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
	"go.mongodb.org/mongo-driver/bson"
	"golang.org/x/crypto/bcrypt"
)

type VerifyOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

func VerifyOTP(c *fiber.Ctx) error {
	var req VerifyOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "message": "Invalid request body"})
	}

	if req.Email == "" || req.OTP == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email and OTP are required", "message": "Email and OTP are required"})
	}

	email := strings.ToLower(req.Email)
	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err := usersCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found", "message": "User not found"})
	}

	if user.VerificationOtp != req.OTP {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid OTP", "message": "Invalid OTP"})
	}

	if time.Now().After(user.OtpExpiry) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "OTP expired", "message": "OTP expired"})
	}

	_, err = usersCollection.UpdateOne(
		ctx,
		bson.M{"email": email},
		bson.M{"$set": bson.M{"emailVerified": true, "verificationOtp": nil, "otpExpiry": nil}},
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to verify email"})
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Token generation failed"})
	}

	c.Cookie(&fiber.Cookie{
		Name:     "connect.sid",
		Value:    tokenString,
		Expires:  time.Now().Add(time.Hour * 24 * 30),
		HTTPOnly: true,
		SameSite: "lax",
	})

	user.EmailVerified = true
	user.VerificationOtp = ""

	return c.JSON(fiber.Map{
		"message": "Email verified successfully",
		"token":   tokenString,
		"user":    user,
	})
}

type EmailRequest struct {
	Email string `json:"email"`
}

func ResendOTP(c *fiber.Ctx) error {
	var req EmailRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "message": "Invalid request body"})
	}

	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email is required", "message": "Email is required"})
	}

	email := strings.ToLower(req.Email)
	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	otp := strconv.Itoa(100000 + rand.Intn(900000))
	otpExpiry := time.Now().Add(10 * time.Minute)

	res, err := usersCollection.UpdateOne(
		ctx,
		bson.M{"email": email},
		bson.M{"$set": bson.M{"verificationOtp": otp, "otpExpiry": otpExpiry}},
	)

	if err != nil || res.MatchedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found", "message": "User not found"})
	}

	if err := services.SendVerificationEmail(email, "", otp); err != nil {
		log.Printf("failed to send resend-otp email to %s: %v", email, err)
	}

	return c.JSON(fiber.Map{"message": "OTP resent successfully"})
}

func Logout(c *fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     "connect.sid",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour), // expire immediately
		HTTPOnly: true,
		SameSite: "lax",
	})

	return c.JSON(fiber.Map{"success": true})
}

func ForgotPassword(c *fiber.Ctx) error {
	var req EmailRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "message": "Invalid request body"})
	}

	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email is required", "message": "Email is required"})
	}

	email := strings.ToLower(req.Email)
	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	otp := strconv.Itoa(100000 + rand.Intn(900000))
	otpExpiry := time.Now().Add(10 * time.Minute)

	res, err := usersCollection.UpdateOne(
		ctx,
		bson.M{"email": email},
		bson.M{"$set": bson.M{"resetToken": otp, "resetTokenExpiry": otpExpiry}},
	)

	if err != nil || res.MatchedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found", "message": "User not found"})
	}

	if err := services.SendPasswordResetEmail(email, "", otp); err != nil {
		log.Printf("failed to send password reset email to %s: %v", email, err)
	}

	return c.JSON(fiber.Map{"message": "Password reset code sent"})
}

type ResetPasswordRequest struct {
	Email    string `json:"email"`
	OTP      string `json:"otp"`
	Password string `json:"password"`
}

func ResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "message": "Invalid request body"})
	}

	if req.Email == "" || req.OTP == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing fields", "message": "Missing fields"})
	}

	email := strings.ToLower(req.Email)
	usersCollection := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err := usersCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found", "message": "User not found"})
	}

	if user.ResetToken != req.OTP {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid reset code", "message": "Invalid reset code"})
	}

	if time.Now().After(user.ResetTokenExpiry) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Reset code expired", "message": "Reset code expired"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Hashing error", "message": "Hashing error"})
	}

	_, err = usersCollection.UpdateOne(
		ctx,
		bson.M{"email": email},
		bson.M{"$set": bson.M{"password": string(hashedPassword), "resetToken": nil, "resetTokenExpiry": nil}},
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to reset password"})
	}

	return c.JSON(fiber.Map{"message": "Password reset successful"})
}
