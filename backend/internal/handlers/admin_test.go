package handlers

import (
	"testing"

	"studybuddy-backend/internal/models"
)

func TestIsAdminUser(t *testing.T) {
	t.Setenv("ADMIN_EMAIL", "owner@example.com")
	t.Setenv("NEXT_PUBLIC_ADMIN_EMAIL", "legacy@example.com")

	cases := []struct {
		name string
		user models.User
		want bool
	}{
		{name: "explicit admin role", user: models.User{Email: "anyone@example.com", Role: "admin"}, want: true},
		{name: "ADMIN_EMAIL exact match", user: models.User{Email: "owner@example.com", Role: "user"}, want: true},
		{name: "ADMIN_EMAIL case-insensitive", user: models.User{Email: "Owner@Example.COM", Role: "user"}, want: true},
		{name: "legacy env match", user: models.User{Email: "legacy@example.com", Role: "user"}, want: true},
		{name: "ordinary user", user: models.User{Email: "student@example.com", Role: "user"}, want: false},
		{name: "empty email", user: models.User{Role: "user"}, want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isAdminUser(tc.user); got != tc.want {
				t.Fatalf("isAdminUser(%+v) = %v, want %v", tc.user, got, tc.want)
			}
		})
	}
}

func TestIsAdminUserRequiresEnv(t *testing.T) {
	t.Setenv("ADMIN_EMAIL", "")
	t.Setenv("NEXT_PUBLIC_ADMIN_EMAIL", "")

	if isAdminUser(models.User{Email: "owner@example.com", Role: "user"}) {
		t.Fatal("email allowlist matched with no admin env configured")
	}
	if !isAdminUser(models.User{Email: "owner@example.com", Role: "admin"}) {
		t.Fatal("explicit admin role was not honoured")
	}
}

func TestIsTempEmail(t *testing.T) {
	for _, email := range []string{"user@mailinator.com", "x@sub.tempmail.org", "y@10minutemail.com"} {
		if !isTempEmail(email) {
			t.Fatalf("isTempEmail(%q) = false, want true", email)
		}
	}
	for _, email := range []string{"user@gmail.com", "student@college.edu", "not-an-email", ""} {
		if isTempEmail(email) {
			t.Fatalf("isTempEmail(%q) = true, want false", email)
		}
	}
}
