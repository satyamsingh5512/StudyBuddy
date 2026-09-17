package services

import (
	"strings"
	"testing"
)

func TestDailyStatsEmailTemplate(t *testing.T) {
	subject, htmlBody, textBody := dailyStatsEmailTemplate("Asha", 45, 6, 12, 320, "2026-09-17", "support@example.com")

	if subject == "" || htmlBody == "" || textBody == "" {
		t.Fatal("template returned an empty part")
	}
	for _, want := range []string{"45", "6", "12", "320", "2026-09-17"} {
		if !strings.Contains(htmlBody, want) || !strings.Contains(textBody, want) {
			t.Fatalf("template bodies do not contain %q", want)
		}
	}
}

func TestDailyStatsEmailTemplateEscapesName(t *testing.T) {
	_, htmlBody, _ := dailyStatsEmailTemplate("<script>alert(1)</script>", 0, 0, 0, 0, "2026-09-17", "support@example.com")
	if strings.Contains(htmlBody, "<script>") {
		t.Fatal("recipient name was not HTML-escaped")
	}
}

func TestAccountDeletionEmailTemplate(t *testing.T) {
	subject, htmlBody, textBody := accountDeletionEmailTemplate("Asha", "123456", "support@example.com")

	if subject == "" || htmlBody == "" || textBody == "" {
		t.Fatal("template returned an empty part")
	}
	if !strings.Contains(htmlBody, "123456") || !strings.Contains(textBody, "123456") {
		t.Fatal("template bodies do not contain the code")
	}
	if strings.Contains(strings.ToLower(htmlBody), "irreversible") == false {
		t.Fatal("template must warn that deletion is irreversible")
	}
}

func TestEmailSendingConfigured(t *testing.T) {
	t.Setenv("RESEND_API_KEY", "")
	t.Setenv("ZEPTOMAIL_SMTP_USER", "")
	t.Setenv("ZEPTOMAIL_SMTP_PASSWORD", "")
	t.Setenv("EMAIL_FROM", "")
	if EmailSendingConfigured() {
		t.Fatal("reported configured with no provider env set")
	}

	t.Setenv("RESEND_API_KEY", "re_test")
	if !EmailSendingConfigured() {
		t.Fatal("did not detect RESEND_API_KEY")
	}
}

func TestLayoutEmailAutomatedFooter(t *testing.T) {
	_, htmlBody, textBody := verificationEmailTemplate("Asha", "123456", "support@example.com")

	for _, want := range []string{"automated email", "satyam.singh@satym.in"} {
		if !strings.Contains(strings.ToLower(htmlBody), want) {
			t.Fatalf("HTML body does not contain %q", want)
		}
		if !strings.Contains(strings.ToLower(textBody), want) {
			t.Fatalf("text body does not contain %q", want)
		}
	}
}
