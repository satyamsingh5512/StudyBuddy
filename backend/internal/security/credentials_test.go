package security

import (
	"errors"
	"testing"
)

func TestNormalizeEmail(t *testing.T) {
	email, err := NormalizeEmail("  Student@Example.COM ")
	if err != nil {
		t.Fatalf("NormalizeEmail() error = %v", err)
	}
	if email != "student@example.com" {
		t.Fatalf("NormalizeEmail() = %q", email)
	}

	if _, err := NormalizeEmail("not-an-email"); !errors.Is(err, ErrInvalidEmail) {
		t.Fatalf("NormalizeEmail() error = %v, want ErrInvalidEmail", err)
	}
}

func TestValidatePassword(t *testing.T) {
	if err := ValidatePassword("correct horse battery staple"); err != nil {
		t.Fatalf("ValidatePassword() error = %v", err)
	}
	if !errors.Is(ValidatePassword("short"), ErrPasswordLength) {
		t.Fatal("ValidatePassword() accepted a short password")
	}
}

func TestOneTimeCodeIsHashedAndVerifiable(t *testing.T) {
	plainText, hash, err := NewOneTimeCode()
	if err != nil {
		t.Fatalf("NewOneTimeCode() error = %v", err)
	}
	if len(plainText) != 6 {
		t.Fatalf("code length = %d", len(plainText))
	}
	if hash == plainText {
		t.Fatal("one-time code was stored in plaintext")
	}
	if !VerifyOneTimeCode(hash, plainText) {
		t.Fatal("VerifyOneTimeCode() rejected the generated code")
	}
	if VerifyOneTimeCode(hash, "000000") && plainText != "000000" {
		t.Fatal("VerifyOneTimeCode() accepted an incorrect code")
	}
}
