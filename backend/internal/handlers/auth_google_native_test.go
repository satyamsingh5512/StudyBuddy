package handlers

import (
	"crypto/sha256"
	"encoding/base64"
	"os"
	"strings"
	"testing"
)

func TestPKCEValueValidationBoundsInput(t *testing.T) {
	verifier := strings.Repeat("a", 32)
	sum := sha256.Sum256([]byte(verifier))
	valid := base64.RawURLEncoding.EncodeToString(sum[:])

	if !isValidPKCEValue(valid) {
		t.Fatalf("expected a base64url SHA-256 digest to be accepted, got rejection for %q", valid)
	}
	if len(valid) != pkceChallengeLength {
		t.Fatalf("expected challenge length %d, got %d", pkceChallengeLength, len(valid))
	}

	rejected := []string{
		"",
		strings.Repeat("a", 42),
		strings.Repeat("a", 44),
		strings.Repeat("a", 42) + "+",  // base64 standard alphabet
		strings.Repeat("a", 42) + "/",  // base64 standard alphabet
		strings.Repeat("a", 42) + "=",  // padding
		strings.Repeat("a", 42) + "\n", // control character
		"../../" + strings.Repeat("a", 37),
	}
	for _, candidate := range rejected {
		if isValidPKCEValue(candidate) {
			t.Fatalf("expected %q to be rejected as a PKCE value", candidate)
		}
	}
}

func TestSHA256Base64URLMatchesChallengeDerivation(t *testing.T) {
	// The app sends base64url(SHA-256(verifier)); the exchange recomputes it.
	verifier := "3sT3bH0L9kQ2mW7xY1pZ4vA6nC8dE0fG2hJ4kL6mN8p"
	sum := sha256.Sum256([]byte(verifier))
	want := base64.RawURLEncoding.EncodeToString(sum[:])
	if got := sha256Base64URL(verifier); got != want {
		t.Fatalf("challenge derivation mismatch: got %q, want %q", got, want)
	}
}

func TestAndroidAppSchemeRejectsUnsafeOverrides(t *testing.T) {
	original, had := os.LookupEnv("ANDROID_APP_SCHEME")
	t.Cleanup(func() {
		if had {
			_ = os.Setenv("ANDROID_APP_SCHEME", original)
			return
		}
		_ = os.Unsetenv("ANDROID_APP_SCHEME")
	})

	if err := os.Unsetenv("ANDROID_APP_SCHEME"); err != nil {
		t.Fatalf("unset: %v", err)
	}
	if scheme := androidAppScheme(); scheme != defaultAndroidAppScheme {
		t.Fatalf("expected default scheme %q, got %q", defaultAndroidAppScheme, scheme)
	}

	// A hostile value must not be able to rewrite the redirect target.
	for _, unsafe := range []string{"https://evil.example", "study buddy", "1studybuddy", "", "  "} {
		if err := os.Setenv("ANDROID_APP_SCHEME", unsafe); err != nil {
			t.Fatalf("setenv: %v", err)
		}
		if scheme := androidAppScheme(); scheme != defaultAndroidAppScheme {
			t.Fatalf("expected %q to fall back to %q, got %q", unsafe, defaultAndroidAppScheme, scheme)
		}
	}

	if err := os.Setenv("ANDROID_APP_SCHEME", "studybuddy-dev"); err != nil {
		t.Fatalf("setenv: %v", err)
	}
	if scheme := androidAppScheme(); scheme != "studybuddy-dev" {
		t.Fatalf("expected a valid custom scheme to be honoured, got %q", scheme)
	}
}

func TestAndroidCallbackRedirectCarriesOnlyTheGivenParameters(t *testing.T) {
	redirect := androidCallbackRedirect(map[string]string{"code": "abc123"})
	if !strings.HasPrefix(redirect, defaultAndroidAppScheme+"://auth/callback?") {
		t.Fatalf("unexpected redirect target: %q", redirect)
	}
	if !strings.Contains(redirect, "code=abc123") {
		t.Fatalf("expected the code to be present, got %q", redirect)
	}
	// A session token must never be placed in a URL.
	for _, forbidden := range []string{"connect.sid", "token=", "jwt"} {
		if strings.Contains(strings.ToLower(redirect), forbidden) {
			t.Fatalf("redirect must not contain %q: %q", forbidden, redirect)
		}
	}

	failure := androidCallbackRedirect(map[string]string{"error": "google_denied"})
	if !strings.Contains(failure, "error=google_denied") {
		t.Fatalf("expected the error code to round-trip, got %q", failure)
	}
}
