/**
 * Email service using Resend
 * Supports OTP verification and password reset emails
 */
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOTPEmail(email: string, otp: string, name?: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`⚠️  Resend API key not configured - OTP: ${otp}`);
    return;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'StudyBuddy <onboarding@resend.dev>',
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
    });
  } catch (error: any) {
    console.error('⚠️  Resend email error:', error.message);
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, otp: string, name?: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`⚠️  Resend API key not configured - Reset OTP: ${otp}`);
    return;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'StudyBuddy <onboarding@resend.dev>',
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
                          Use the following code to reset your password:
                        </p>
                        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 20px 0;">
                          <div style="font-size: 36px; font-weight: 700; color: #6366f1; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${otp}
                          </div>
                        </div>
                        <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                          This code will expire in <strong>10 minutes</strong>.<br>
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
    });
  } catch (error: any) {
    console.error('⚠️  Resend email error:', error.message);
    throw error;
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`⚠️  Resend API key not configured - Skipping welcome email for ${email}`);
    return;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'StudyBuddy <onboarding@resend.dev>',
      to: email,
      subject: `🎉 Welcome aboard, ${name}! - StudyBuddy`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to StudyBuddy</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="padding: 40px 40px 20px; text-align: center;">
                        <h1 style="margin: 0; color: #6366f1; font-size: 32px; font-weight: 700;">🎓 StudyBuddy</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 40px 20px; text-align: center;">
                        <h2 style="margin: 0; color: #1f2937; font-size: 28px; font-weight: 600;">Welcome aboard, ${name}! 🚀</h2>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 40px 30px;">
                        <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;">
                          Your journey to success starts now! We're absolutely thrilled to have you with us.
                        </p>
                        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 20px 0;">
                          <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 500; line-height: 1.5;">
                            ✨ "The secret of getting ahead is getting started." ✨
                          </p>
                        </div>
                        <p style="margin: 20px 0 0; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;">
                          You're now part of a community of ambitious learners. Here's to achieving great things together!
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 40px 30px; text-align: center;">
                        <a href="${process.env.APP_URL || 'https://studybuddy.app'}" style="display: inline-block; background-color: #6366f1; color: #ffffff; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
                          Start Studying →
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 20px 40px 40px; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5; text-align: center;">
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
    });
    console.log(`📧 Welcome email sent to ${email}`);
  } catch (error: any) {
    console.error('⚠️  Welcome email error:', error.message);
    // Don't throw - welcome email failure shouldn't block onboarding
  }
}
