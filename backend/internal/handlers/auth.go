package handlers

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/security"
	"studybuddy-backend/internal/services"
	"studybuddy-backend/internal/session"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

const (
	maxLoginAttempts  = 5
	loginLockDuration = 15 * time.Minute
)

var dummyPasswordHash, _ = bcrypt.GenerateFromPassword([]byte("studybuddy-invalid-login-password"), bcrypt.DefaultCost)

type SignupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func Signup(c *fiber.Ctx) error {
	var req SignupRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "Invalid request body")
	}

	email, err := security.NormalizeEmail(req.Email)
	if err != nil {
		return badRequest(c, err.Error())
	}
	if err := security.ValidatePassword(req.Password); err != nil {
		return badRequest(c, err.Error())
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || len([]rune(name)) > 100 {
		return badRequest(c, "Name must be between 1 and 100 characters")
	}

	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existingUser models.User
	err = usersCollection.FindOne(ctx, bson.M{"email": email}).Decode(&existingUser)
	if err == nil {
		return badRequest(c, "Unable to create account with those details")
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return serverError(c)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return serverError(c)
	}
	otp, otpHash, err := security.NewOneTimeCode()
	if err != nil {
		return serverError(c)
	}

	now := time.Now().UTC()
	username := strings.ToLower(strings.ReplaceAll(name, " ", "")) + "_" + uuid.New().String()[:8]
	newUser := models.User{
		Email:           email,
		Password:        string(hashedPassword),
		Name:            name,
		Username:        username,
		Role:            "user",
		EmailVerified:   false,
		VerificationOtp: otpHash,
		OtpExpiry:       now.Add(10 * time.Minute),
		OnboardingDone:  false,
		CreatedAt:       now,
		UpdatedAt:       now,
		LastActive:      now,
		ShowProfile:     true,
	}

	result, err := usersCollection.InsertOne(ctx, newUser)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return badRequest(c, "Unable to create account with those details")
		}
		return serverError(c)
	}
	newUser.ID = result.InsertedID.(primitive.ObjectID)

	if err := services.SendVerificationEmail(newUser.Email, newUser.Name, otp); err != nil {
		log.Printf("signup verification email failed for user %s: %v", newUser.ID.Hex(), err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "If the details are valid, a verification code has been sent.",
	})
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "Invalid request body")
	}

	email, emailErr := security.NormalizeEmail(req.Email)
	if emailErr != nil || req.Password == "" || len([]rune(req.Password)) > security.MaxPasswordLength {
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(req.Password))
		return invalidCredentials(c)
	}

	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err := usersCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		_ = bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(req.Password))
		return invalidCredentials(c)
	}
	if err != nil {
		return serverError(c)
	}

	now := time.Now().UTC()
	if user.LoginLockedUntil != nil && user.LoginLockedUntil.After(now) {
		c.Set(fiber.HeaderRetryAfter, "900")
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"error": "Too many sign-in attempts. Please try again later.",
		})
	}

	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)) != nil {
		recordFailedLogin(ctx, usersCollection, user, now)
		return invalidCredentials(c)
	}

	if !user.EmailVerified {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Verify your email before signing in.",
			"code":  "EMAIL_NOT_VERIFIED",
		})
	}

	_, _ = usersCollection.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
		"$set":   bson.M{"failedLoginAttempts": 0, "lastActive": now},
		"$unset": bson.M{"loginLockedUntil": ""},
	})

	tokenString, err := session.Issue(user.ID.Hex(), user.Email, user.Role, user.SessionVersion)
	if err != nil {
		return serverError(c)
	}

	setSessionCookie(c, tokenString)

	return c.JSON(fiber.Map{
		"message": "Login successful",
		"user":    user,
	})
}

func recordFailedLogin(ctx context.Context, users *mongo.Collection, user models.User, now time.Time) {
	attempts := user.FailedLoginAttempts + 1
	update := bson.M{"$set": bson.M{"failedLoginAttempts": attempts}}
	if attempts >= maxLoginAttempts {
		update = bson.M{"$set": bson.M{
			"failedLoginAttempts": 0,
			"loginLockedUntil":    now.Add(loginLockDuration),
		}}
	}
	_, _ = users.UpdateOne(ctx, bson.M{"_id": user.ID}, update)
}

func invalidCredentials(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"error":   "Invalid email or password",
		"message": "Invalid email or password",
	})
}

func badRequest(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": message, "message": message})
}

func serverError(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"error":   "Unable to complete the request",
		"message": "Unable to complete the request",
	})
}

func Me(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, _ = reconcileUserStats(ctx, &user, time.Now().Location(), time.Now())

	var freshUser models.User
	if err := config.DB.Collection("users").FindOne(ctx, bson.M{"_id": user.ID}).Decode(&freshUser); err == nil {
		return c.JSON(freshUser)
	}
	return c.JSON(user)
}
