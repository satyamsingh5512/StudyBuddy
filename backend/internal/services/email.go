package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

var ErrEmailServiceNotConfigured = errors.New("email service is not configured")

type resendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

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

func sendResendEmail(to, subject, htmlBody, textBody string) error {
	apiKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	from := strings.TrimSpace(os.Getenv("EMAIL_FROM"))
	if apiKey == "" || from == "" {
		return ErrEmailServiceNotConfigured
	}

	payload := resendPayload{
		From:    from,
		To:      []string{to},
		Subject: subject,
		HTML:    htmlBody,
		Text:    textBody,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("resend api error (%d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

func SendVerificationEmail(to, name, otp string) error {
	subject, htmlBody, textBody := verificationEmailTemplate(name, otp, supportEmailAddress())
	return sendResendEmail(to, subject, htmlBody, textBody)
}

func SendPasswordResetEmail(to, name, otp string) error {
	subject, htmlBody, textBody := resetEmailTemplate(name, otp, supportEmailAddress())
	return sendResendEmail(to, subject, htmlBody, textBody)
}

func SendOnboardingWelcomeEmail(to, name string) error {
	subject, htmlBody, textBody := onboardingWelcomeTemplate(name, supportEmailAddress())
	return sendResendEmail(to, subject, htmlBody, textBody)
}
