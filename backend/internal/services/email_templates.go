package services

import (
	"fmt"
	"html"
	"strings"
)

func displayName(name string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "there"
	}
	return html.EscapeString(trimmed)
}

// queriesEmailAddress is the single human contact shown in the footer of every
// automated email. Kept as one address (not a second "support" line) to match
// how Amazon/Microsoft-style transactional mail shows exactly one contact.
const queriesEmailAddress = "satyam.singh@satym.in"

// logoMarkSVG is the same "open book" mark used by the web app's header logo
// (see src/components/Logo.tsx / resources/icon.svg), redrawn as a
// self-contained, table-safe inline SVG for email clients. It intentionally
// mirrors the app icon's two page-panels + bookmark strokes and color values
// (#6366f1 / #818cf8 / #4f46e5) on the same dark navy tile (#0f172a) used by
// resources/icon.svg, so the email header reads as the same brand mark.
const logoMarkSVG = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="StudyBuddy">
<rect width="40" height="40" rx="9" fill="#0f172a"/>
<path d="M8 10 L8 30 L20 28 L20 8 Z" fill="#6366f1" opacity="0.9"/>
<path d="M20 8 L20 28 L32 30 L32 10 Z" fill="#818cf8"/>
<path d="M18 6 L18 16 L20 14 L22 16 L22 6 Z" fill="#4f46e5"/>
</svg>`

// layoutEmail renders the shared chrome around every transactional email:
// a centered brand header with the app's logo mark, a plain white content
// card, and a single-line footer with one contact address. The visual
// language (white background, neutral grays, one accent color, generous
// spacing, sans-serif type) matches the conventions used by Amazon and
// Microsoft account-security email, rather than a decorative theme.
func layoutEmail(title, preheader, intro, contentHTML, outro, supportEmail string) (string, string) {
	titleEscaped := html.EscapeString(title)
	preheaderEscaped := html.EscapeString(preheader)
	introEscaped := html.EscapeString(intro)
	outroEscaped := html.EscapeString(outro)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
  </head>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">%s</span>
    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="padding:40px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 8px 24px;text-align:center;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                  <tr>
                    <td style="padding-right:10px;vertical-align:middle;">%s</td>
                    <td style="vertical-align:middle;text-align:left;">
                      <span style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.2px;">StudyBuddy</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(17,24,39,0.08);overflow:hidden;">
            <tr>
              <td style="padding:36px 40px 8px;">
                <h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;font-weight:700;color:#111827;">%s</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#4b5563;">%s</p>
                %s
                <p style="margin:22px 0 0;font-size:13px;line-height:1.65;color:#6b7280;">%s</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                  This is an automated email — please don't reply directly.
                  Questions? Contact <a href="mailto:%s" style="color:#4f46e5;text-decoration:none;">%s</a>.
                </p>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:20px 8px 0;text-align:center;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; StudyBuddy &middot; sbd.satym.in</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`, preheaderEscaped, logoMarkSVG, titleEscaped, introEscaped, contentHTML, outroEscaped, queriesEmailAddress, queriesEmailAddress)

	textBody := fmt.Sprintf("%s\n\n%s\n\n%s\n\n%s\n\nThis is an automated email. Questions? Contact: %s", title, intro, strings.TrimSpace(contentHTML), outro, queriesEmailAddress)
	_ = supportEmail // retained for call-site compatibility; the footer now shows a single contact address.
	return htmlBody, textBody
}

// otpBlockHTML renders a large, centered, monospaced verification code in the
// same visual style used by Amazon/Microsoft OTP emails: a neutral card, a
// small uppercase label, a wide-tracked numeric code, and an expiry line.
func otpBlockHTML(label, code, expiryNote string) string {
	return fmt.Sprintf(`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;">
  <tr>
    <td style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:24px;text-align:center;">
      <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:1.4px;text-transform:uppercase;">%s</div>
      <div style="margin-top:10px;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#111827;">%s</div>
      <div style="margin-top:12px;font-size:13px;color:#6b7280;">%s</div>
    </td>
  </tr>
</table>`, html.EscapeString(label), html.EscapeString(code), html.EscapeString(expiryNote))
}

func verificationEmailTemplate(name, otp, supportEmail string) (string, string, string) {
	safeName := displayName(name)

	subject := "Verify your StudyBuddy email"
	intro := fmt.Sprintf("Hi %s, use the verification code below to confirm your email address and finish setting up your StudyBuddy account.", safeName)
	content := otpBlockHTML("Verification code", otp, "This code expires in 10 minutes.")
	outro := "If you didn't request this, you can safely ignore this email — no changes will be made to your account."

	htmlBody, textBody := layoutEmail("Verify your email address", "Your StudyBuddy verification code", intro, content, outro, supportEmail)
	textBody = fmt.Sprintf("Verification code: %s\n\n%s", otp, textBody)
	return subject, htmlBody, textBody
}

func resetEmailTemplate(name, otp, supportEmail string) (string, string, string) {
	safeName := displayName(name)

	subject := "Reset your StudyBuddy password"
	intro := fmt.Sprintf("Hi %s, we received a request to reset the password for your StudyBuddy account. Enter the code below to continue.", safeName)
	content := otpBlockHTML("Password reset code", otp, "This code expires in 10 minutes.")
	outro := "If you didn't request a password reset, no action is needed — your password will not be changed. For your security, consider reviewing your account activity."

	htmlBody, textBody := layoutEmail("Reset your password", "Your StudyBuddy password reset code", intro, content, outro, supportEmail)
	textBody = fmt.Sprintf("Password reset code: %s\n\n%s", otp, textBody)
	return subject, htmlBody, textBody
}

func onboardingWelcomeTemplate(name, supportEmail string) (string, string, string) {
	safeName := displayName(name)

	subject := "Welcome to StudyBuddy"
	intro := fmt.Sprintf("Hi %s, your profile is set up and your workspace is ready to go.", safeName)
	content := `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;">
  <tr>
    <td style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#374151;">
        You can now access your dashboard, track study sessions, and plan your exam preparation with StudyBuddy.
      </p>
    </td>
  </tr>
</table>`
	outro := "Thanks for choosing StudyBuddy."

	htmlBody, textBody := layoutEmail("Your account is ready", "Your StudyBuddy account is ready", intro, content, outro, supportEmail)
	return subject, htmlBody, textBody
}

func dailyStatsEmailTemplate(name string, minutes, todosCompleted, streak, totalPoints int, date, supportEmail string) (string, string, string) {
	safeName := displayName(name)
	safeDate := html.EscapeString(date)

	subject := fmt.Sprintf("Your StudyBuddy day - %s", safeDate)
	intro := fmt.Sprintf("Hi %s, here's how your %s went on StudyBuddy.", safeName, safeDate)
	statCell := func(label, value string) string {
		return fmt.Sprintf(`<td width="50%%" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:1.2px;text-transform:uppercase;">%s</div>
        <div style="margin-top:6px;font-size:24px;font-weight:700;color:#111827;">%s</div>
      </td>`, html.EscapeString(label), html.EscapeString(value))
	}
	content := fmt.Sprintf(`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;border-spacing:8px 8px;border-collapse:separate;">
  <tr>
    %s
    %s
  </tr>
  <tr>
    %s
    %s
  </tr>
</table>`,
		statCell("Minutes studied", fmt.Sprintf("%d", minutes)),
		statCell("Tasks completed", fmt.Sprintf("%d", todosCompleted)),
		statCell("Day streak", fmt.Sprintf("%d", streak)),
		statCell("Total points", fmt.Sprintf("%d", totalPoints)),
	)
	outro := "Keep the streak alive — even a short session counts."

	htmlBody, textBody := layoutEmail("Your daily study summary", fmt.Sprintf("%d minutes, %d tasks on %s", minutes, todosCompleted, date), intro, content, outro, supportEmail)
	return subject, htmlBody, textBody
}

func accountDeletionEmailTemplate(name, otp, supportEmail string) (string, string, string) {
	safeName := displayName(name)

	subject := "Confirm permanent deletion of your StudyBuddy account"
	intro := fmt.Sprintf("Hi %s, we received a request to permanently delete your StudyBuddy account and all associated data.", safeName)
	content := fmt.Sprintf(`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;">
  <tr>
    <td style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:24px;text-align:center;">
      <div style="font-size:11px;font-weight:600;color:#b91c1c;letter-spacing:1.4px;text-transform:uppercase;">Deletion code</div>
      <div style="margin-top:10px;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#7f1d1d;">%s</div>
      <div style="margin-top:12px;font-size:13px;color:#b91c1c;">This code expires in 10 minutes. Deletion is permanent and irreversible — tasks, goals, journals, notes, schedules, messages, and your profile will be removed.</div>
    </td>
  </tr>
</table>`, html.EscapeString(otp))
	outro := "If you didn't request this, do nothing and your account will stay untouched. As a precaution, consider changing your password."

	htmlBody, textBody := layoutEmail("Confirm account deletion", "Your StudyBuddy account deletion code", intro, content, outro, supportEmail)
	textBody = fmt.Sprintf("Deletion code: %s\n\n%s", otp, textBody)
	return subject, htmlBody, textBody
}
