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
	clientURL := appClientURL()
	redirectUri := googleCallbackURL(c)
	if redirectUri == "" {
		return c.Redirect(googleErrorRedirect("google_failed"))
	}

	code := c.Query("code")
	errorParam := c.Query("error")
	returnedState := c.Query("state")
	storedState := c.Cookies(googleOAuthStateCookie)

	if errorParam != "" || code == "" {
		return c.Redirect(googleErrorRedirect("google_denied"))
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
		return c.Redirect(googleErrorRedirect("google_invalid_state"))
	}

	clientID := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET"))
	if clientID == "" || clientSecret == "" {
		return c.Redirect(googleErrorRedirect("google_not_configured"))
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
		return c.Redirect(googleErrorRedirect("google_failed"))
	}
	defer tokenResp.Body.Close()

	var tokenData struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenData); err != nil {
		return c.Redirect(googleErrorRedirect("google_failed"))
	}

	// Fetch Google profile
	req, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	req.Header.Add("Authorization", "Bearer "+tokenData.AccessToken)

	client := &http.Client{}
	profileResp, err := client.Do(req)
	if err != nil || profileResp.StatusCode != 200 {
		return c.Redirect(googleErrorRedirect("google_failed"))
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
		return c.Redirect(googleErrorRedirect("google_failed"))
	}

	if profile.Email == "" || !profile.VerifiedEmail {
		return c.Redirect(googleErrorRedirect("google_unverified_email"))
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
			return c.Redirect(googleErrorRedirect("google_failed"))
		}
		user.ID = res.InsertedID.(primitive.ObjectID)
		user.Email = profile.Email
		user.Role = "user"
	}

	tokenString, err := session.Issue(user.ID.Hex(), user.Email, user.Role, user.SessionVersion)
	if err != nil {
		return c.Redirect(googleErrorRedirect("google_failed"))
	}

	setSessionCookie(c, tokenString)

	return c.Redirect(clientURL + "/auth?oauth=success")
}
