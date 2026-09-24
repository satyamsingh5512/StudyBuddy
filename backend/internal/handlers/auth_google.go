package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/session"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const googleOAuthStateCookie = "google_oauth_state"

// appClientURL resolves the absolute app origin used to build user-facing
// redirects. It must always return an absolute URL: a schemeless value would be
// treated as a relative path by the browser and resolve against whatever origin
// the user is currently on (e.g. http://localhost:<port>/example.com/auth).
func appClientURL() string {
	clientURL := strings.TrimSpace(os.Getenv("CLIENT_URL"))
	if clientURL == "" {
		clientURL = strings.TrimSpace(os.Getenv("NEXT_PUBLIC_APP_URL"))
	}
	if clientURL == "" {
		if os.Getenv("NODE_ENV") == "production" {
			log.Println("auth: CLIENT_URL and NEXT_PUBLIC_APP_URL are unset; user-facing redirects will point at localhost")
		}
		clientURL = "http://localhost:3000"
	}
	clientURL = strings.TrimRight(clientURL, "/")

	// Guarantee an absolute origin even when the variable omits the scheme.
	if !strings.HasPrefix(clientURL, "http://") && !strings.HasPrefix(clientURL, "https://") {
		clientURL = "https://" + clientURL
	}
	return clientURL
}

func googleCallbackURL(_ *fiber.Ctx) string {
	callback := strings.TrimSpace(os.Getenv("GOOGLE_CALLBACK_URL"))
	if callback != "" {
		return callback
	}

	// Return through the frontend's same-origin /api proxy. Sending the callback
	// directly to a separately hosted API makes the session cookie third-party.
	return fmt.Sprintf("%s/api/auth/google/callback", appClientURL())
}

func googleErrorRedirect(code string) string {
	return fmt.Sprintf("%s/auth?error=%s", appClientURL(), code)
}

// isNativeAuthRequest reports whether the Android app started this flow.
func isNativeAuthRequest(c *fiber.Ctx) bool {
	return strings.EqualFold(strings.TrimSpace(c.Query("platform")), "android")
}

func clearGooglePKCECookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     googlePKCECookie,
		Value:    "",
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
		SameSite: "lax",
		Secure:   secureCookie(c),
	})
}

// googleFailure sends the browser back to the app deep link for a native flow
// and to the web auth screen otherwise, so an APK user never lands on an
// unrecoverable browser page.
func googleFailure(c *fiber.Ctx, native bool, code string) error {
	if native {
		return c.Redirect(androidCallbackRedirect(map[string]string{"error": code}))
	}
	return c.Redirect(googleErrorRedirect(code))
}

func generateOAuthState() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func GoogleAuth(c *fiber.Ctx) error {
	clientId := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID"))
	if clientId == "" {
		return c.Redirect(googleErrorRedirect("google_not_configured"))
	}

	state, err := generateOAuthState()
	if err != nil {
		return c.Redirect(googleErrorRedirect("google_failed"))
	}

	c.Cookie(&fiber.Cookie{
		Name:     googleOAuthStateCookie,
		Value:    state,
		Expires:  time.Now().Add(10 * time.Minute),
		HTTPOnly: true,
		SameSite: "lax",
		Secure:   secureCookie(c),
	})

	// Native (APK) flow: the consent screen runs in a Custom Tab whose cookie jar
	// the app WebView cannot read, so remember the PKCE challenge and complete
	// sign-in through a single-use code instead of a browser session cookie.
	// The challenge is bound to this browser via an HttpOnly cookie so a crafted
	// callback URL cannot inject a different one.
	if isNativeAuthRequest(c) {
		challenge := strings.TrimSpace(c.Query("code_challenge"))
		if !isValidPKCEValue(challenge) {
			return c.Redirect(googleErrorRedirect("google_failed"))
		}
		c.Cookie(&fiber.Cookie{
			Name:     googlePKCECookie,
			Value:    challenge,
			Expires:  time.Now().Add(10 * time.Minute),
			HTTPOnly: true,
			SameSite: "lax",
			Secure:   secureCookie(c),
		})
	} else {
		// Clear any stale native marker so a later browser sign-in on the same
		// device cannot be redirected into the app deep link.
		clearGooglePKCECookie(c)
	}

	redirectUri := googleCallbackURL(c)
	if redirectUri == "" {
		return c.Redirect(googleErrorRedirect("google_failed"))
	}

	params := url.Values{}
	params.Add("client_id", clientId)
	params.Add("redirect_uri", redirectUri)
	params.Add("response_type", "code")
	params.Add("scope", "openid email profile")
	params.Add("access_type", "offline")
	params.Add("prompt", "consent")
	params.Add("state", state)

	googleAuthUrl := fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?%s", params.Encode())
	return c.Redirect(googleAuthUrl)
}

func GoogleCallback(c *fiber.Ctx) error {
	// The PKCE challenge cookie is the authoritative signal that this flow was
	// started by the Android app; the query string is not trusted here. It is
	// resolved first so every failure path can return the user to the app.
	pkceChallenge := strings.TrimSpace(c.Cookies(googlePKCECookie))
	native := isValidPKCEValue(pkceChallenge)
	// Always clear it so one native attempt cannot affect a later browser sign-in.
	clearGooglePKCECookie(c)

	clientURL := appClientURL()
	redirectUri := googleCallbackURL(c)
	if redirectUri == "" {
		return googleFailure(c, native, "google_failed")
	}

	code := c.Query("code")
	errorParam := c.Query("error")
	returnedState := c.Query("state")
	storedState := c.Cookies(googleOAuthStateCookie)

	if errorParam != "" || code == "" {
		return googleFailure(c, native, "google_denied")
	}

	// Clear state cookie after callback to prevent replay.
	c.Cookie(&fiber.Cookie{
		Name:     googleOAuthStateCookie,
		Value:    "",
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
		SameSite: "lax",
		Secure:   secureCookie(c),
	})

	if returnedState == "" || storedState == "" || returnedState != storedState {
		return googleFailure(c, native, "google_invalid_state")
	}

	clientID := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET"))
	if clientID == "" || clientSecret == "" {
		return googleFailure(c, native, "google_not_configured")
	}

	// Exchange code for token
	tokenReqBody := url.Values{}
	tokenReqBody.Add("code", code)
	tokenReqBody.Add("client_id", clientID)
	tokenReqBody.Add("client_secret", clientSecret)
	tokenReqBody.Add("redirect_uri", redirectUri)
	tokenReqBody.Add("grant_type", "authorization_code")

	tokenResp, err := http.PostForm("https://oauth2.googleapis.com/token", tokenReqBody)
	if err != nil || tokenResp.StatusCode != 200 {
		return googleFailure(c, native, "google_failed")
	}
	defer tokenResp.Body.Close()

	var tokenData struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenData); err != nil {
		return googleFailure(c, native, "google_failed")
	}

	// Fetch Google profile
	req, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Add("Authorization", "Bearer "+tokenData.AccessToken)

	client := &http.Client{}
	profileResp, err := client.Do(req)
	if err != nil || profileResp.StatusCode != 200 {
		return googleFailure(c, native, "google_failed")
	}
	defer profileResp.Body.Close()

	var profile struct {
		Id            string `json:"id"`
		Email         string `json:"email"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
		VerifiedEmail bool   `json:"verified_email"`
	}
	if err := json.NewDecoder(profileResp.Body).Decode(&profile); err != nil {
		return googleFailure(c, native, "google_failed")
	}

	if profile.Email == "" || !profile.VerifiedEmail {
		return googleFailure(c, native, "google_unverified_email")
	}

	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err = usersCollection.FindOne(ctx, bson.M{
		"$or": []bson.M{
			{"googleId": profile.Id},
			{"email": profile.Email},
		},
	}).Decode(&user)

	if err == nil {
		// User exists, update if no googleId
		var rawUser bson.M
		_ = usersCollection.FindOne(ctx, bson.M{"_id": user.ID}).Decode(&rawUser)

		if rawUser["googleId"] == nil || rawUser["googleId"] == "" {
			avatar := rawUser["avatar"]
			if avatar == nil || avatar == "" {
				avatar = profile.Picture
			}

			usersCollection.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
				"$set": bson.M{
					"googleId":      profile.Id,
					"avatar":        avatar,
					"emailVerified": true,
					"updatedAt":     time.Now(),
				},
			})
		}
	} else {
		// New User
		baseUsername := strings.ToLower(profile.Name)
		username := baseUsername + "_" + uuid.New().String()[:8]

		newUser := models.User{
			Email:          profile.Email,
			Name:           profile.Name,
			Username:       username,
			Role:           "user",
			EmailVerified:  true,
			OnboardingDone: false,
			TotalPoints:    0,
			TotalStudyMins: 0,
			Streak:         0,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
			LastActive:     time.Now(),
			ShowProfile:    true,
		}

		res, err := usersCollection.InsertOne(ctx, bson.M{
			"email":             newUser.Email,
			"googleId":          profile.Id,
			"name":              newUser.Name,
			"username":          newUser.Username,
			"avatar":            profile.Picture,
			"role":              newUser.Role,
			"emailVerified":     newUser.EmailVerified,
			"onboardingDone":    newUser.OnboardingDone,
			"totalPoints":       newUser.TotalPoints,
			"totalStudyMinutes": newUser.TotalStudyMins,
			"streak":            newUser.Streak,
			"createdAt":         newUser.CreatedAt,
			"updatedAt":         newUser.UpdatedAt,
			"lastActive":        newUser.LastActive,
			"showProfile":       newUser.ShowProfile,
		})

		if err != nil {
			return googleFailure(c, native, "google_failed")
		}
		user.ID = res.InsertedID.(primitive.ObjectID)
		user.Email = profile.Email
		user.Role = "user"
	}

	if native {
		// Deliberately no setSessionCookie here: the Custom Tab must not end up
		// holding a StudyBuddy session. The app exchanges this single-use code
		// for its own cookie from inside the WebView.
		exchangeCode, codeErr := newAuthExchangeCode(ctx, user.ID, pkceChallenge)
		if codeErr != nil {
			return googleFailure(c, native, "google_failed")
		}
		return c.Redirect(androidCallbackRedirect(map[string]string{"code": exchangeCode}))
	}

	tokenString, err := session.Issue(user.ID.Hex(), user.Email, user.Role, user.SessionVersion)
	if err != nil {
		return googleFailure(c, native, "google_failed")
	}

	setSessionCookie(c, tokenString)

	return c.Redirect(clientURL + "/auth?oauth=success")
}
