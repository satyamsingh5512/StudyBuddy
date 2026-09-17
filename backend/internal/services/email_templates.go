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

// queriesEmailAddress is the human contact for questions about automated mail.
const queriesEmailAddress = "satyam.singh@satym.in"

func layoutEmail(title, preheader, intro, contentHTML, outro, supportEmail string) (string, string) {
	titleEscaped := html.EscapeString(title)
	preheaderEscaped := html.EscapeString(preheader)
	introEscaped := html.EscapeString(intro)
	outroEscaped := html.EscapeString(outro)
	supportEmailEscaped := html.EscapeString(supportEmail)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f6f1e7;font-family:Georgia,'Times New Roman',serif;color:#292524;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">%s</span>
    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e7dcc3;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:26px 36px;background-color:#92400e;border-bottom:3px solid #f59e0b;">
                <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:1.3;font-weight:bold;color:#fffbeb;letter-spacing:0.3px;">StudyBuddy</h1>
                <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#fde68a;">Study support for competitive exam preparation</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 36px;">
                <h2 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.35;font-weight:bold;color:#1c1917;">%s</h2>
                <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#44403c;">%s</p>
                %s
                <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#57534e;">%s</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px;border-top:1px solid #e7dcc3;background-color:#faf6ec;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#78716c;">
                  This is an automated email — please do not reply directly. For any queries, email us at <a href="mailto:%s" style="color:#92400e;text-decoration:underline;">%s</a>.
                </p>
                <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#78716c;">
                  Need help? Contact us at <a href="mailto:%s" style="color:#92400e;text-decoration:underline;">%s</a>.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a8a29e;">&copy; StudyBuddy &middot; sbd.satym.in</p>
        </td>
      </tr>
    </table>
  </body>
</html>`, preheaderEscaped, titleEscaped, introEscaped, contentHTML, outroEscaped, queriesEmailAddress, queriesEmailAddress, supportEmailEscaped, supportEmailEscaped)

	textBody := fmt.Sprintf("%s\n\n%s\n\n%s\n\n%s\n\nThis is an automated email. For any queries, email: %s\n\nSupport: %s", title, intro, strings.TrimSpace(contentHTML), outro, queriesEmailAddress, supportEmail)
	return htmlBody, textBody
}

func verificationEmailTemplate(name, otp, supportEmail string) (string, string, string) {
	safeName := displayName(name)
	safeOTP := html.EscapeString(otp)

	subject := "Verify your StudyBuddy email"
	intro := fmt.Sprintf("Hi %s, please use the verification code below to confirm your StudyBuddy account.", safeName)
	content := fmt.Sprintf(`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 8px;">
  <tr>
    <td style="background-color:#fffbeb;border:1px solid #d97706;border-radius:10px;padding:18px;text-align:center;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#92400e;letter-spacing:1.6px;text-transform:uppercase;">Verification Code</div>
      <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:bold;letter-spacing:8px;color:#78350a;">%s</div>
      <div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#92600e;">This code expires in 10 minutes.</div>
    </td>
  </tr>
</table>`, safeOTP)
	outro := "If you did not create an account, you can safely ignore this message."

	htmlBody, textBody := layoutEmail("Verify your account", "Your StudyBuddy verification code", intro, content, outro, supportEmail)
	textBody = fmt.Sprintf("Verification code: %s\n\n%s", otp, textBody)
	return subject, htmlBody, textBody
}

func resetEmailTemplate(name, otp, supportEmail string) (string, string, string) {
	safeName := displayName(name)
	safeOTP := html.EscapeString(otp)

	subject := "Reset your StudyBuddy password"
	intro := fmt.Sprintf("Hi %s, we received a request to reset your StudyBuddy password.", safeName)
	content := fmt.Sprintf(`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 8px;">
  <tr>
    <td style="background-color:#fffbeb;border:1px solid #d97706;border-radius:10px;padding:18px;text-align:center;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#92400e;letter-spacing:1.6px;text-transform:uppercase;">Reset Code</div>
      <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:bold;letter-spacing:8px;color:#78350a;">%s</div>
      <div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#92600e;">This code expires in 10 minutes.</div>
    </td>
  </tr>
</table>`, safeOTP)
	outro := "If you did not request a password reset, please secure your account immediately."

	htmlBody, textBody := layoutEmail("Password reset request", "Your StudyBuddy password reset code", intro, content, outro, supportEmail)
	textBody = fmt.Sprintf("Reset code: %s\n\n%s", otp, textBody)
	return subject, htmlBody, textBody
}

func onboardingWelcomeTemplate(name, supportEmail string) (string, string, string) {
	safeName := displayName(name)

	subject := "Welcome to StudyBuddy"
	intro := fmt.Sprintf("Hi %s, your profile setup is complete and your workspace is ready.", safeName)
	content := `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 8px;">
  <tr>
    <td style="background-color:#fffbeb;border:1px solid #e7dcc3;border-radius:10px;padding:18px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#44403c;">
        You can now access your dashboard, track study sessions, and organize your exam preparation plan with StudyBuddy.
      </p>
    </td>
  </tr>
</table>`
	outro := "Thank you for choosing StudyBuddy."

	htmlBody, textBody := layoutEmail("Profile setup complete", "Your StudyBuddy account is ready", intro, content, outro, supportEmail)
	return subject, htmlBody, textBody
}

func dailyStatsEmailTemplate(name string, minutes, todosCompleted, streak, totalPoints int, date, supportEmail string) (string, string, string) {
	safeName := displayName(name)
	safeDate := html.EscapeString(date)

	subject := fmt.Sprintf("Your StudyBuddy day — %s", safeDate)
	intro := fmt.Sprintf("Hi %s, here is how your %s went on StudyBuddy.", safeName, safeDate)
	statCell := func(label, value string) string {
		return fmt.Sprintf(`<td style="background-color:#fffbeb;border:1px solid #e7dcc3;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#92400e;letter-spacing:1.6px;text-transform:uppercase;">%s</div>
        <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:#1c1917;">%s</div>
      </td>`, html.EscapeString(label), html.EscapeString(value))
	}
	content := fmt.Sprintf(`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 8px;">
  <tr>
    %s
    %s
  </tr>
  <tr><td style="height:10px;line-height:10px;">&nbsp;</td><td style="height:10px;line-height:10px;">&nbsp;</td></tr>
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
	safeOTP := html.EscapeString(otp)

	subject := "Confirm permanent deletion of your StudyBuddy account"
	intro := fmt.Sprintf("Hi %s, we received a request to permanently delete your StudyBuddy account and all associated data.", safeName)
	content := fmt.Sprintf(`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 8px;">
  <tr>
    <td style="background-color:#fef2f2;border:1px solid #b91c1c;border-radius:10px;padding:18px;text-align:center;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#991b1b;letter-spacing:1.6px;text-transform:uppercase;">Deletion Code</div>
      <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:32px;font-weight:bold;letter-spacing:8px;color:#7f1d1d;">%s</div>
      <div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#991b1b;">This code expires in 10 minutes. Deletion is irreversible: tasks, goals, journals, notes, schedules, messages, and your profile are removed.</div>
    </td>
  </tr>
</table>`, safeOTP)
	outro := "If you did not request this, do nothing — your account stays untouched. Consider changing your password."

	htmlBody, textBody := layoutEmail("Confirm account deletion", "Your StudyBuddy account deletion code", intro, content, outro, supportEmail)
	textBody = fmt.Sprintf("Deletion code: %s\n\n%s", otp, textBody)
	return subject, htmlBody, textBody
}
