package security

import (
	"crypto/rand"
	"errors"
	"math/big"
	"net/mail"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

const (
	MinPasswordLength = 8
	MaxPasswordLength = 72
)

var (
	ErrInvalidEmail   = errors.New("enter a valid email address")
	ErrPasswordLength = errors.New("password must be between 8 and 72 characters")
	oneTimeCodeRange  = big.NewInt(900000)
)

func NormalizeEmail(value string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	address, err := mail.ParseAddress(normalized)
	if err != nil || address.Address != normalized || len(normalized) > 254 {
		return "", ErrInvalidEmail
	}
	return normalized, nil
}

func ValidatePassword(password string) error {
	length := len([]rune(password))
	if length < MinPasswordLength || length > MaxPasswordLength {
		return ErrPasswordLength
	}
	return nil
}

func NewOneTimeCode() (plainText string, hash string, err error) {
	value, err := rand.Int(rand.Reader, oneTimeCodeRange)
	if err != nil {
		return "", "", err
	}

	plainText = leftPadSixDigits(value.Int64() + 100000)
	hashed, err := bcrypt.GenerateFromPassword([]byte(plainText), bcrypt.DefaultCost)
	if err != nil {
		return "", "", err
	}
	return plainText, string(hashed), nil
}

func VerifyOneTimeCode(hash, candidate string) bool {
	if len(candidate) != 6 || hash == "" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(candidate)) == nil
}

func leftPadSixDigits(value int64) string {
	digits := [6]byte{'0', '0', '0', '0', '0', '0'}
	for index := len(digits) - 1; index >= 0 && value > 0; index-- {
		digits[index] = byte('0' + value%10)
		value /= 10
	}
	return string(digits[:])
}
