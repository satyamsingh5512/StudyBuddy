package handlers

// Native (Android APK) Google sign-in completion.
//
// Why this exists: Google refuses OAuth inside embedded WebViews
// ("disallowed_useragent"), so the APK must run the consent screen in a real
// browser surface (an in-app Custom Tab). The session cookie set in that browser
// is NOT visible to the app's WebView, so the browser cannot be the place the
// app becomes authenticated.
//
// Flow:
//  1. WebView generates a PKCE verifier, sends only SHA-256(verifier) as the
//     challenge, and opens /api/auth/google?platform=android&code_challenge=...
//     in a Custom Tab.
//  2. GoogleCallback verifies Google, then (for the native flow) issues NO
//     browser session. It mints a single-use exchange code bound to the
//     challenge and redirects to the app deep link with that code only.
//  3. The WebView posts the code plus the original verifier here. Only then is
//     the `connect.sid` cookie issued, into the WebView's own cookie jar.
//
// A custom-scheme deep link can in principle be claimed by another installed
// app, so the code alone is deliberately useless: without the matching verifier
// the exchange fails. See docs/android-google-auth.md for the remaining
// hardening step (Android App Links + assetlinks.json).

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/session"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	authExchangeCollection = "auth_exchange_codes"
	// Short enough that an intercepted code is near-useless, long enough to
	// survive the Custom Tab dismissal and the app regaining foreground.
	authExchangeTTL = 2 * time.Minute
	// base64url(SHA-256) is always 43 unpadded characters.
	pkceChallengeLength = 43
	googlePKCECookie    = "google_oauth_pkce"
	defaultAndroidAppScheme = "studybuddy"
)

// Base64url without padding. Bounds the input so a hostile query string cannot
// push arbitrary bytes into storage or into a redirect.
var pkceValuePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)

// androidAppScheme is the custom scheme registered by the Android manifest.
func androidAppScheme() string {
	scheme := strings.ToLower(strings.TrimSpace(os.Getenv("ANDROID_APP_SCHEME")))
	if scheme == "" {
		return defaultAndroidAppScheme
	}
	// Only a plain scheme name is acceptable; anything else would build a
	// malformed or attacker-influenced redirect target.
	if !regexp.MustCompile(`^[a-z][a-z0-9+.-]{1,31}$`).MatchString(scheme) {
		return defaultAndroidAppScheme
	}
	return scheme
}

func androidCallbackRedirect(values map[string]string) string {
	parts := make([]string, 0, len(values))
	for key, value := range values {
		parts = append(parts, fmt.Sprintf("%s=%s", key, value))
	}
	return fmt.Sprintf("%s://auth/callback?%s", androidAppScheme(), strings.Join(parts, "&"))
}

// isValidPKCEValue reports whether value is a well-formed base64url SHA-256 digest.
func isValidPKCEValue(value string) bool {
	return len(value) == pkceChallengeLength && pkceValuePattern.MatchString(value)
}

func sha256Base64URL(value string) string {
	sum := sha256.Sum256([]byte(value))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func sha256Hex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

// newAuthExchangeCode stores a single-use code bound to the PKCE challenge and
// returns the plaintext code, which is only ever delivered to the app deep link.
func newAuthExchangeCode(ctx context.Context, userID primitive.ObjectID, challenge string) (string, error) {
	if !isValidPKCEValue(challenge) {
		return "", errors.New("invalid code challenge")
	}
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	code := base64.RawURLEncoding.EncodeToString(buf)
	now := time.Now().UTC()
	_, err := config.DB.Collection(authExchangeCollection).InsertOne(ctx, bson.M{
		"codeHash":  sha256Hex(code),
		"userId":    userID,
		"challenge": challenge,
		"createdAt": now,
		"expiresAt": now.Add(authExchangeTTL),
	})
	if err != nil {
		return "", err
	}
	return code, nil
}

type googleExchangeRequest struct {
	Code         string `json:"code"`
	CodeVerifier string `json:"codeVerifier"`
}

// GoogleNativeExchange converts a one-time native sign-in code into the normal
// cookie session. It is the only place the native flow becomes authenticated.
func GoogleNativeExchange(c *fiber.Ctx) error {
	var req googleExchangeRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	code := strings.TrimSpace(req.Code)
	verifier := strings.TrimSpace(req.CodeVerifier)
	// Both values are fixed-length base64url; reject anything else before touching the database.
	if !isValidPKCEValue(code) || !isValidPKCEValue(verifier) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Invalid sign-in code",
			"message": "Invalid sign-in code",
		})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now().UTC()
	// Atomically claim the code: the usedAt filter makes redemption single-use
	// even if two requests race.
	var record struct {
		UserID    primitive.ObjectID `bson:"userId"`
		Challenge string             `bson:"challenge"`
	}
	err := config.DB.Collection(authExchangeCollection).FindOneAndUpdate(
		ctx,
		bson.M{
			"codeHash":  sha256Hex(code),
			"usedAt":    bson.M{"$exists": false},
			"expiresAt": bson.M{"$gt": now},
		},
		bson.M{"$set": bson.M{"usedAt": now}},
		options.FindOneAndUpdate().SetReturnDocument(options.Before),
	).Decode(&record)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "This sign-in link expired. Start Google sign-in again.",
				"message": "This sign-in link expired. Start Google sign-in again.",
			})
		}
		return serverError(c)
	}

	// PKCE binding: possession of the code is not enough without the verifier
	// that produced the stored challenge.
	if subtle.ConstantTimeCompare([]byte(record.Challenge), []byte(sha256Base64URL(verifier))) != 1 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Sign-in verification failed",
			"message": "Sign-in verification failed",
		})
	}

	var user models.User
	if err := config.DB.Collection("users").FindOne(ctx, bson.M{"_id": record.UserID}).Decode(&user); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Account is no longer available",
			"message": "Account is no longer available",
		})
	}

	tokenString, err := session.Issue(user.ID.Hex(), user.Email, user.Role, user.SessionVersion)
	if err != nil {
		return serverError(c)
	}
	setSessionCookie(c, tokenString)

	_, _ = config.DB.Collection("users").UpdateOne(ctx, bson.M{"_id": user.ID},
		bson.M{"$set": bson.M{"lastActive": time.Now()}})

	models.NormalizeUserPreferences(&user)
	return c.JSON(fiber.Map{
		"authenticated":  true,
		"onboardingDone": user.OnboardingDone,
	})
}
