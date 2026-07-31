package session

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	Duration            = 30 * 24 * time.Hour
	minimumSecretLength = 32
)

var ErrInvalidConfiguration = errors.New("SESSION_SECRET must contain at least 32 bytes")

type Claims struct {
	Email          string `json:"email"`
	Role           string `json:"role"`
	SessionVersion int    `json:"ver"`
	jwt.RegisteredClaims
}

func secret() ([]byte, error) {
	value := os.Getenv("SESSION_SECRET")
	if strings.TrimSpace(value) == "" || len([]byte(value)) < minimumSecretLength {
		return nil, ErrInvalidConfiguration
	}
	return []byte(value), nil
}

func ValidateConfiguration() error {
	_, err := secret()
	return err
}

func Issue(subject, email, role string, sessionVersion int) (string, error) {
	if strings.TrimSpace(subject) == "" {
		return "", errors.New("session subject is required")
	}

	key, err := secret()
	if err != nil {
		return "", err
	}

	now := time.Now().UTC()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{
		Email:          email,
		Role:           role,
		SessionVersion: sessionVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(Duration)),
		},
	})

	return token.SignedString(key)
}

func Parse(tokenString string) (*Claims, error) {
	key, err := secret()
	if err != nil {
		return nil, err
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(
		tokenString,
		claims,
		func(_ *jwt.Token) (interface{}, error) { return key, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, fmt.Errorf("invalid session token: %w", err)
	}
	if !token.Valid {
		return nil, errors.New("invalid session token")
	}

	return claims, nil
}
