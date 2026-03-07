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

func layoutEmail(title, preheader, intro, contentHTML, outro, supportEmail string) (string, string) {
	titleEscaped := html.EscapeString(title)
	preheaderEscaped := html.EscapeString(preheader)
	introEscaped := html.EscapeString(intro)
	outroEscaped := html.EscapeString(outro)
	supportEmailEscaped := html.EscapeString(supportEmail)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0a0f1f;background-image:linear-gradient(135deg,#0a0f1f 0%%,#111a2f 55%%,#1c2a46 100%%);font-family:Arial,Helvetica,sans-serif;color:#f3f4f6;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">%s</span>
    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#0f172a;border:1px solid #22314f;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(90deg,#102042 0%%,#1b2f57 100%%);border-bottom:1px solid #2d4066;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;color:#f8fafc;">StudyBuddy</h1>
                <p style="margin:8px 0 0;font-size:13px;color:#c7d2fe;letter-spacing:0.2px;">Reliable study support for competitive exam preparation</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f8fafc;">%s</h2>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#d1d5db;">%s</p>
                %s
                <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#cbd5e1;">%s</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;border-top:1px solid #22314f;background:#0b1327;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  Need help? Contact us at <a href="mailto:%s" style="color:#c7d2fe;text-decoration:none;">%s</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`, preheaderEscaped, titleEscaped, introEscaped, contentHTML, outroEscaped, supportEmailEscaped, supportEmailEscaped)

	textBody := fmt.Sprintf("%s\n\n%s\n\n%s\n\n%s\n\nSupport: %s", title, intro, strings.TrimSpace(contentHTML), outro, supportEmail)
	return htmlBody, textBody
}

func verificationEmailTemplate(name, otp, supportEmail string) (string, string, string) {
	safeName := displayName(name)
	safeOTP := html.EscapeString(otp)

	subject := "Verify your StudyBuddy email"
	intro := fmt.Sprintf("Hi %s, please use the verification code below to confirm your StudyBuddy account.", safeName)
	content := fmt.Sprintf(`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 8px;">
  <tr>
    <td style="background:#111b35;border:1px solid #334b7c;border-radius:12px;padding:16px;text-align:center;">
      <div style="font-size:11px;color:#94a3b8;letter-spacing:1.6px;text-transform:uppercase;">Verification Code</div>
      <div style="margin-top:8px;font-size:32px;font-weight:700;letter-spacing:8px;color:#f8fafc;">%s</div>
      <div style="margin-top:10px;font-size:13px;color:#cbd5e1;">This code expires in 10 minutes.</div>
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
    <td style="background:#111b35;border:1px solid #334b7c;border-radius:12px;padding:16px;text-align:center;">
      <div style="font-size:11px;color:#94a3b8;letter-spacing:1.6px;text-transform:uppercase;">Reset Code</div>
      <div style="margin-top:8px;font-size:32px;font-weight:700;letter-spacing:8px;color:#f8fafc;">%s</div>
      <div style="margin-top:10px;font-size:13px;color:#cbd5e1;">This code expires in 10 minutes.</div>
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
    <td style="background:#111b35;border:1px solid #334b7c;border-radius:12px;padding:16px;">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#dbe4ff;">
        You can now access your dashboard, track study sessions, and organize your exam preparation plan with StudyBuddy.
      </p>
    </td>
  </tr>
</table>`
	outro := "Thank you for choosing StudyBuddy."

	htmlBody, textBody := layoutEmail("Profile setup complete", "Your StudyBuddy account is ready", intro, content, outro, supportEmail)
	return subject, htmlBody, textBody
}
