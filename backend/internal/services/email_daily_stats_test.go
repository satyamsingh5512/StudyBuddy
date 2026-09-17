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
