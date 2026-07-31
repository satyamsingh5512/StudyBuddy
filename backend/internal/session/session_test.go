package session

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "studybuddy-test-session-secret-with-more-than-32-characters"

func TestValidateConfiguration(t *testing.T) {
	tests := []struct {
		name   string
		secret string
		valid  bool
	}{
		{name: "missing", secret: "", valid: false},
		{name: "too short", secret: "short-secret", valid: false},
		{name: "valid", secret: testSecret, valid: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("SESSION_SECRET", tt.secret)
			err := ValidateConfiguration()
			if tt.valid && err != nil {
				t.Fatalf("ValidateConfiguration() error = %v", err)
			}
			if !tt.valid && !errors.Is(err, ErrInvalidConfiguration) {
				t.Fatalf("ValidateConfiguration() error = %v, want ErrInvalidConfiguration", err)
			}
		})
	}
}

func TestIssueAndParse(t *testing.T) {
	t.Setenv("SESSION_SECRET", testSecret)

	token, err := Issue("507f1f77bcf86cd799439011", "student@example.com", "user", 3)
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}

	claims, err := Parse(token)
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if claims.Subject != "507f1f77bcf86cd799439011" {
		t.Errorf("claims.Subject = %q", claims.Subject)
	}
	if claims.Email != "student@example.com" || claims.Role != "user" {
		t.Errorf("claims identity = %q/%q", claims.Email, claims.Role)
	}
	if claims.SessionVersion != 3 {
		t.Errorf("claims.SessionVersion = %d", claims.SessionVersion)
	}
	if claims.ExpiresAt == nil || time.Until(claims.ExpiresAt.Time) <= 29*24*time.Hour {
		t.Errorf("claims.ExpiresAt = %v, want approximately 30 days", claims.ExpiresAt)
	}
}

func TestParseRejectsExpiredToken(t *testing.T) {
	t.Setenv("SESSION_SECRET", testSecret)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "507f1f77bcf86cd799439011",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
		},
	})
	signed, err := token.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("SignedString() error = %v", err)
	}

	if _, err := Parse(signed); err == nil {
		t.Fatal("Parse() accepted an expired token")
	}
}

func TestParseRejectsUnexpectedAlgorithm(t *testing.T) {
	t.Setenv("SESSION_SECRET", testSecret)
	token := jwt.NewWithClaims(jwt.SigningMethodHS384, Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "507f1f77bcf86cd799439011",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	signed, err := token.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("SignedString() error = %v", err)
	}

	if _, err := Parse(signed); err == nil {
		t.Fatal("Parse() accepted a token signed with HS384")
	}
}
