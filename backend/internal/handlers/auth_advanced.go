package handlers

import (
	"context"
	"errors"
	"log"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/security"
	"studybuddy-backend/internal/services"
	"studybuddy-backend/internal/session"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

const maxCodeAttempts = 5

var invalidCodeResponse = fiber.Map{
	"error":   "Invalid or expired code",
	"message": "Invalid or expired code",
}

type VerifyOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

func VerifyOTP(c *fiber.Ctx) error {
	var req VerifyOTPRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	email, err := security.NormalizeEmail(req.Email)
	if err != nil || len(req.OTP) != 6 {
		return c.Status(fiber.StatusBadRequest).JSON(invalidCodeResponse)
	}

	users := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	if err := users.FindOne(ctx, bson.M{"email": email}).Decode(&user); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(invalidCodeResponse)
	}
	if user.EmailVerified {
		return badRequest(c, "Email is already verified")
	}
	if user.VerificationAttempts >= maxCodeAttempts || time.Now().After(user.OtpExpiry) ||
		!security.VerifyOneTimeCode(user.VerificationOtp, req.OTP) {
		_, _ = users.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$inc": bson.M{"verificationAttempts": 1}})
		return c.Status(fiber.StatusBadRequest).JSON(invalidCodeResponse)
	}

	result, err := users.UpdateOne(ctx, bson.M{
		"_id":             user.ID,
		"emailVerified":   false,
		"verificationOtp": user.VerificationOtp,
	}, bson.M{
		"$set":   bson.M{"emailVerified": true, "verificationAttempts": 0},
		"$unset": bson.M{"verificationOtp": "", "otpExpiry": ""},
	})
	if err != nil || result.ModifiedCount != 1 {
		return serverError(c)
	}

	tokenString, err := session.Issue(user.ID.Hex(), user.Email, user.Role, user.SessionVersion)
	if err != nil {
		return serverError(c)
	}
	setSessionCookie(c, tokenString)

	user.EmailVerified = true
	return c.JSON(fiber.Map{
		"message": "Email verified successfully",
		"user":    user,
	})
}

type EmailRequest struct {
	Email string `json:"email"`
}

func ResendOTP(c *fiber.Ctx) error {
	var req EmailRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	email, err := security.NormalizeEmail(req.Email)
	if err != nil {
		return badRequest(c, err.Error())
	}

	otp, otpHash, err := security.NewOneTimeCode()
	if err != nil {
		return serverError(c)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := config.DB.Collection("users").UpdateOne(ctx, bson.M{
		"email": email, "emailVerified": false,
	}, bson.M{"$set": bson.M{
		"verificationOtp":      otpHash,
		"otpExpiry":            time.Now().Add(10 * time.Minute),
		"verificationAttempts": 0,
	}})
	if err != nil {
		return serverError(c)
	}
	if result.MatchedCount > 0 {
		if err := services.SendVerificationEmail(email, "", otp); err != nil {
			log.Printf("resend verification email failed: %v", err)
		}
	}

	return c.JSON(fiber.Map{"message": "If the account requires verification, a new code has been sent."})
}

func Logout(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := config.DB.Collection("users").UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{
		"$inc": bson.M{"sessionVersion": 1},
	}); err != nil {
		return serverError(c)
	}
	clearSessionCookie(c)
	return c.JSON(fiber.Map{"success": true})
}

func ForgotPassword(c *fiber.Ctx) error {
	var req EmailRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	email, err := security.NormalizeEmail(req.Email)
	if err != nil {
		return badRequest(c, err.Error())
	}

	genericResponse := fiber.Map{"message": "If an account with that email exists, a password reset code has been sent."}
	otp, otpHash, err := security.NewOneTimeCode()
	if err != nil {
		return c.JSON(genericResponse)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	result, err := config.DB.Collection("users").UpdateOne(ctx, bson.M{"email": email}, bson.M{"$set": bson.M{
		"resetToken":       otpHash,
		"resetTokenExpiry": time.Now().Add(10 * time.Minute),
		"resetAttempts":    0,
	}})
	if err != nil {
		log.Printf("forgot-password database update failed: %v", err)
		return c.JSON(genericResponse)
	}
	if result.MatchedCount > 0 {
		if err := services.SendPasswordResetEmail(email, "", otp); err != nil {
			log.Printf("password reset email failed: %v", err)
		}
	}
	return c.JSON(genericResponse)
}

type ResetPasswordRequest struct {
	Email    string `json:"email"`
	OTP      string `json:"otp"`
	Password string `json:"password"`
}

func ResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return badRequest(c, "Invalid request body")
	}
	if err := security.ValidatePassword(req.Password); err != nil {
		return badRequest(c, err.Error())
	}
	email, err := security.NormalizeEmail(req.Email)
	if err != nil || len(req.OTP) != 6 {
		return c.Status(fiber.StatusBadRequest).JSON(invalidCodeResponse)
	}

	users := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	if err := users.FindOne(ctx, bson.M{"email": email}).Decode(&user); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(invalidCodeResponse)
	}
	if user.ResetAttempts >= maxCodeAttempts || time.Now().After(user.ResetTokenExpiry) ||
		!security.VerifyOneTimeCode(user.ResetToken, req.OTP) {
		_, _ = users.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$inc": bson.M{"resetAttempts": 1}})
		return c.Status(fiber.StatusBadRequest).JSON(invalidCodeResponse)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return serverError(c)
	}
	result, err := users.UpdateOne(ctx, bson.M{
		"_id": user.ID, "resetToken": user.ResetToken,
	}, bson.M{
		"$set": bson.M{"password": string(hashedPassword), "resetAttempts": 0},
		"$inc": bson.M{"sessionVersion": 1},
		"$unset": bson.M{
			"resetToken":       "",
			"resetTokenExpiry": "",
			"loginLockedUntil": "",
		},
	})
	if err != nil || result.ModifiedCount != 1 {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return c.Status(fiber.StatusBadRequest).JSON(invalidCodeResponse)
		}
		return serverError(c)
	}

	return c.JSON(fiber.Map{"message": "Password reset successful"})
}
