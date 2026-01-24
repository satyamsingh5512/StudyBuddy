/**
 * Email service using Nodemailer
 * Supports OTP verification and password reset emails
 */
import nodemailer from 'nodemailer';

// Create transporter function to ensure env vars are loaded
function createTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendOTPEmail(email: string, otp: string, name?: string): Promise<void> {
  const transporter = createTransporter();
  
  // Skip email sending if SMTP not configured
  if (!transporter) {
    console.log(`⚠️  SMTP not configured - OTP: ${otp}`);
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"StudyBuddy" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify Your Email - StudyBuddy',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px;">
                      <h1 style="margin: 0; color: #6366f1; font-size: 28px; font-weight: 700;">StudyBuddy</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 40px 20px;">
                      <h2 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 600;">Verify Your Email</h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 40px 30px;">
                      <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.5;">
                        ${name ? `Hi ${name},` : 'Hello,'}<br><br>
                        Thank you for signing up! Please use the following OTP to verify your email address:
                      </p>
                      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 20px 0;">
                        <div style="font-size: 36px; font-weight: 700; color: #6366f1; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                          ${otp}
                        </div>
                      </div>
                      <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                        This OTP will expire in <strong>10 minutes</strong>.<br>
                        If you didn't request this, please ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px 40px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                        © ${new Date().getFullYear()} StudyBuddy. All rights reserved.<br>
                        AI-Powered Study Companion
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export async function sendPasswordResetEmail(email: string, resetToken: string, name?: string): Promise<void> {
  const transporter = createTransporter();
  
  // Skip email sending if SMTP not configured
  if (!transporter) {
    console.log(`⚠️  SMTP not configured - Reset token: ${resetToken}`);
    return;
  }

  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || `"StudyBuddy" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Reset Your Password - StudyBuddy',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px;">
                      <h1 style="margin: 0; color: #6366f1; font-size: 28px; font-weight: 700;">StudyBuddy</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 40px 20px;">
                      <h2 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 0 40px 30px;">
                      <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.5;">
                        ${name ? `Hi ${name},` : 'Hello,'}<br><br>
                        We received a request to reset your password. Click the button below to create a new password:
                      </p>
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                          Reset Password
                        </a>
                      </div>
                      <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                        This link will expire in <strong>1 hour</strong>.<br>
                        If you didn't request this, please ignore this email and your password will remain unchanged.
                      </p>
                      <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                        Or copy and paste this URL into your browser:<br>
                        <span style="word-break: break-all;">${resetUrl}</span>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px 40px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                        © ${new Date().getFullYear()} StudyBuddy. All rights reserved.<br>
                        AI-Powered Study Companion
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
}
