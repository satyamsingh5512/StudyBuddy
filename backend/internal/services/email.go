package services

import (
	"errors"
	"fmt"
	"mime"
	"net/smtp"
	"os"
	"strings"
)

var ErrEmailServiceNotConfigured = errors.New("email service is not configured")

// supportEmailAddress extracts the raw email address from EMAIL_FROM, which may
// be in either "Display Name <addr@example.com>" or plain "addr@example.com" form.
func supportEmailAddress() string {
	from := strings.TrimSpace(os.Getenv("EMAIL_FROM"))
	if from == "" {
		return "support@studybuddy.app"
	}

	start := strings.Index(from, "<")
	end := strings.Index(from, ">")
	if start != -1 && end > start+1 {
		return strings.TrimSpace(from[start+1 : end])
	}

	return from
}

// sendZeptoEmail sends a transactional email through ZeptoMail's SMTP relay.
//
// Required environment variables:
//   ZEPTOMAIL_SMTP_USER     – SMTP username shown in the ZeptoMail mail-agent
//   ZEPTOMAIL_SMTP_PASSWORD – SMTP token / password for the mail-agent
//   EMAIL_FROM              – Sender address, e.g. "StudyBuddy <noreply@studybuddy.app>"
//
// Optional environment variables (sensible defaults are applied):
//   ZEPTOMAIL_SMTP_HOST     – defaults to smtp.zeptomail.in
//   ZEPTOMAIL_SMTP_PORT     – defaults to 587
func sendZeptoEmail(to, subject, htmlBody, textBody string) error {
	smtpUser := strings.TrimSpace(os.Getenv("ZEPTOMAIL_SMTP_USER"))
	smtpPass := strings.TrimSpace(os.Getenv("ZEPTOMAIL_SMTP_PASSWORD"))
	from := strings.TrimSpace(os.Getenv("EMAIL_FROM"))

	if smtpUser == "" || smtpPass == "" || from == "" {
		return ErrEmailServiceNotConfigured
	}

	smtpHost := strings.TrimSpace(os.Getenv("ZEPTOMAIL_SMTP_HOST"))
	if smtpHost == "" {
		smtpHost = "smtp.zeptomail.in"
	}

	smtpPort := strings.TrimSpace(os.Getenv("ZEPTOMAIL_SMTP_PORT"))
	if smtpPort == "" {
		smtpPort = "587"
	}

	addr := smtpHost + ":" + smtpPort

	// Build a minimal multipart/alternative MIME message.
	fromAddr := supportEmailAddress()
	encodedSubject := mime.QEncoding.Encode("UTF-8", subject)

	var msg strings.Builder
	boundary := "----=_ZeptoMailBoundary"

	msg.WriteString(fmt.Sprintf("From: %s\r\n", from))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", to))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", encodedSubject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n", boundary))
	msg.WriteString("\r\n")

	// Plain-text part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: quoted-printable\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(textBody)
	msg.WriteString("\r\n")

	// HTML part
	msg.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: quoted-printable\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)
	msg.WriteString("\r\n")

	// Closing boundary
	msg.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)

	err := smtp.SendMail(addr, auth, fromAddr, []string{to}, []byte(msg.String()))
	if err != nil {
		return fmt.Errorf("zeptomail smtp error: %w", err)
	}

	return nil
}

func SendVerificationEmail(to, name, otp string) error {
	subject, htmlBody, textBody := verificationEmailTemplate(name, otp, supportEmailAddress())
	return sendZeptoEmail(to, subject, htmlBody, textBody)
}

func SendPasswordResetEmail(to, name, otp string) error {
	subject, htmlBody, textBody := resetEmailTemplate(name, otp, supportEmailAddress())
	return sendZeptoEmail(to, subject, htmlBody, textBody)
}

func SendOnboardingWelcomeEmail(to, name string) error {
	subject, htmlBody, textBody := onboardingWelcomeTemplate(name, supportEmailAddress())
	return sendZeptoEmail(to, subject, htmlBody, textBody)
}
