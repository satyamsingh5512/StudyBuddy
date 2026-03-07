package handlers

import (
	"context"
	"log"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

type SignupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

func Signup(c *fiber.Ctx) error {
	var req SignupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "message": "Invalid request body"})
	}

	if req.Email == "" || req.Password == "" || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing fields", "message": "Missing fields"})
	}

	email := strings.ToLower(req.Email)
	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var existingUser models.User
	err := usersCollection.FindOne(ctx, bson.M{"email": email}).Decode(&existingUser)
	if err == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email already exists", "message": "Email already exists"})
	} else if err != mongo.ErrNoDocuments {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database error", "message": "Database error"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Hashing error", "message": "Hashing error"})
	}

	otp := strconv.Itoa(100000 + rand.Intn(900000))
	otpExpiry := time.Now().Add(10 * time.Minute)

	baseUsername := strings.ToLower(req.Name)
	username := baseUsername + "_" + uuid.New().String()[:8]

	newUser := models.User{
		Email:           email,
		Password:        string(hashedPassword),
		Name:            req.Name,
		Username:        username,
		Role:            "user",
		EmailVerified:   false,
		VerificationOtp: otp,
		OtpExpiry:       otpExpiry,
		OnboardingDone:  false,
		TotalPoints:     0,
		TotalStudyMins:  0,
		Streak:          0,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
		LastActive:      time.Now(),
		ShowProfile:     true,
	}

	result, err := usersCollection.InsertOne(ctx, newUser)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database error", "message": "Database error"})
	}

	newUser.ID = result.InsertedID.(primitive.ObjectID)
	if err := services.SendVerificationEmail(newUser.Email, newUser.Name, otp); err != nil {
		log.Printf("failed to send signup verification email to %s: %v", newUser.Email, err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Signup successful. Please verify your email.",
		"user":    newUser,
	})
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "message": "Invalid request body"})
	}

	email := strings.ToLower(req.Email)
	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err := usersCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials", "message": "Invalid credentials"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database error", "message": "Database error"})
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials", "message": "Invalid credentials"})
	}

	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		secret = "supersecret_studybuddy_dev_key"
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   user.ID.Hex(),
		"email": user.Email,
		"role":  user.Role,
		"exp":   time.Now().Add(time.Hour * 24 * 30).Unix(),
	})

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Token generation failed", "message": "Token generation failed"})
	}

	c.Cookie(&fiber.Cookie{
		Name:     "connect.sid",
		Value:    tokenString,
		Expires:  time.Now().Add(time.Hour * 24 * 30),
		HTTPOnly: true,
		SameSite: "lax",
	})

	return c.JSON(fiber.Map{
		"message": "Login successful",
		"token":   tokenString,
		"user":    user,
	})
}

func Me(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	return c.JSON(user)
}
