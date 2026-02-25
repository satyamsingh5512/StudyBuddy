/**
 * Email service using Resend
 * Supports OTP verification and password reset emails
 */
import { Resend } from 'resend';

// Lazy-initialize the Resend client to ensure env vars are loaded
// (fixes race condition where module loads before dotenv/config runs)
let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendOTPEmail(email: string, otp: string, name?: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`⚠️  Resend API key not configured - OTP: ${otp}`);
    return;
  }

  try {
    console.log(`📧 Attempting to send OTP email to: ${email}`);
    const result = await getResendClient().emails.send({
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
    console.log(`✅ OTP email sent successfully to ${email}. Email ID:`, result.data?.id || 'N/A');
  } catch (error: any) {
    console.error('❌ Failed to send OTP email to:', email);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      statusCode: error.statusCode,
      response: error.response?.data || error.response || 'No response data'
    });
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, otp: string, name?: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`⚠️  Resend API key not configured - Reset OTP: ${otp}`);
    return;
  }

  try {
    await getResendClient().emails.send({
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

export async function sendDailyStatsEmail(
  email: string,
  name: string,
  stats: {
    completedTodos: number;
    totalTodos: number;
    completedSchedules: number;
    totalSchedules: number;
    studyMinutes: number;
    streak: number;
    totalPoints: number;
  }
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`⚠️  Resend API key not configured - Skipping daily stats for ${email}`);
    return;
  }

  const motivationalQuotes = [
    "Success is the sum of small efforts repeated day in and day out.",
    "The expert in anything was once a beginner.",
    "Don't watch the clock; do what it does. Keep going.",
    "The only way to do great work is to love what you do.",
    "Believe you can and you're halfway there.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "The future depends on what you do today.",
    "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.",
    "The beautiful thing about learning is that no one can take it away from you.",
    "Strive for progress, not perfection."
  ];

  const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
  const studyHours = Math.floor(stats.studyMinutes / 60);
  const studyMins = stats.studyMinutes % 60;
  const todoCompletionRate = stats.totalTodos > 0 ? Math.round((stats.completedTodos / stats.totalTodos) * 100) : 0;
  const scheduleCompletionRate = stats.totalSchedules > 0 ? Math.round((stats.completedSchedules / stats.totalSchedules) * 100) : 0;

  try {
    await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || 'StudyBuddy <onboarding@resend.dev>',
      to: email,
      subject: 'Your Daily Study Summary - StudyBuddy',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Daily Study Summary</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">

                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; text-align: center;">
                        <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 28px; font-weight: 700;">StudyBuddy</h1>
                        <p style="margin: 0; color: #e0e7ff; font-size: 14px; font-weight: 500; letter-spacing: 0.5px;">DAILY STUDY SUMMARY</p>
                      </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                      <td style="padding: 32px 40px 24px;">
                        <h2 style="margin: 0 0 8px; color: #1e293b; font-size: 22px; font-weight: 600;">Hello ${name},</h2>
                        <p style="margin: 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                          Here's a summary of your progress today. Keep up the excellent work.
                        </p>
                      </td>
                    </tr>

                    <!-- Stats Grid -->
                    <tr>
                      <td style="padding: 0 40px 24px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="50%" style="padding-right: 8px;">
                              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center;">
                                <div style="color: #6366f1; font-size: 32px; font-weight: 700; margin-bottom: 4px;">${stats.completedTodos}/${stats.totalTodos}</div>
                                <div style="color: #64748b; font-size: 13px; font-weight: 500;">Tasks Completed</div>
                                ${stats.totalTodos > 0 ? `<div style="color: #10b981; font-size: 12px; font-weight: 600; margin-top: 4px;">${todoCompletionRate}%</div>` : ''}
                              </div>
                            </td>
                            <td width="50%" style="padding-left: 8px;">
                              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center;">
                                <div style="color: #8b5cf6; font-size: 32px; font-weight: 700; margin-bottom: 4px;">${stats.completedSchedules}/${stats.totalSchedules}</div>
                                <div style="color: #64748b; font-size: 13px; font-weight: 500;">Schedule Items</div>
                                ${stats.totalSchedules > 0 ? `<div style="color: #10b981; font-size: 12px; font-weight: 600; margin-top: 4px;">${scheduleCompletionRate}%</div>` : ''}
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Study Time & Streak -->
                    <tr>
                      <td style="padding: 0 40px 24px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="50%" style="padding-right: 8px;">
                              <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; text-align: center;">
                                <div style="color: #d97706; font-size: 28px; font-weight: 700; margin-bottom: 4px;">
                                  ${studyHours > 0 ? `${studyHours}h ${studyMins}m` : `${studyMins}m`}
                                </div>
                                <div style="color: #92400e; font-size: 13px; font-weight: 500;">Study Time</div>
                              </div>
                            </td>
                            <td width="50%" style="padding-left: 8px;">
                              <div style="background-color: #dbeafe; border-radius: 8px; padding: 20px; text-align: center;">
                                <div style="color: #2563eb; font-size: 28px; font-weight: 700; margin-bottom: 4px;">${stats.streak} days</div>
                                <div style="color: #1e40af; font-size: 13px; font-weight: 500;">Current Streak</div>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Total Points -->
                    <tr>
                      <td style="padding: 0 40px 32px;">
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; padding: 24px; text-align: center;">
                          <div style="color: #ffffff; font-size: 36px; font-weight: 700; margin-bottom: 4px;">${stats.totalPoints.toLocaleString()}</div>
                          <div style="color: #d1fae5; font-size: 14px; font-weight: 500; letter-spacing: 0.5px;">TOTAL POINTS EARNED</div>
                        </div>
                      </td>
                    </tr>

                    <!-- Motivational Quote -->
                    <tr>
                      <td style="padding: 0 40px 32px;">
                        <div style="border-left: 4px solid #6366f1; background-color: #f8fafc; padding: 20px 24px; border-radius: 4px;">
                          <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.7; font-style: italic;">
                            "${quote}"
                          </p>
                        </div>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
                        <p style="margin: 0 0 16px; color: #64748b; font-size: 13px; line-height: 1.5;">
                          Keep pushing forward. Every step counts toward your goal.
                        </p>
                        <a href="${process.env.CLIENT_URL || 'https://studybuddy.app'}" style="display: inline-block; background-color: #6366f1; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 6px; text-decoration: none; margin-bottom: 16px;">
                          Continue Learning
                        </a>
                        <p style="margin: 16px 0 0; color: #94a3b8; font-size: 11px; line-height: 1.5;">
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
    console.log(`📧 Daily stats email sent to ${email}`);
  } catch (error: any) {
    console.error('⚠️  Daily stats email error:', error.message);
    throw error;
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`⚠️  Resend API key not configured - Skipping welcome email for ${email}`);
    return;
  }

  try {
    await getResendClient().emails.send({
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

export async function sendWaitlistConfirmationEmail(email: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`⚠️  Resend API key not configured - Skipping waitlist email for ${email}`);
    return;
  }

  try {
    await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || 'StudyBuddy <onboarding@resend.dev>',
      to: email,
      subject: '📱 You\'re on the Waitlist! - StudyBuddy Android App',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Waitlist Confirmation</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; text-align: center; border-radius: 12px 12px 0 0;">
                        <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 28px; font-weight: 700;">📱 StudyBuddy</h1>
                        <p style="margin: 0; color: #e0e7ff; font-size: 14px; font-weight: 500; letter-spacing: 0.5px;">ANDROID APP WAITLIST</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 32px 40px 20px; text-align: center;">
                        <h2 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 600;">You're on the list! 🎉</h2>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 40px 30px;">
                        <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6; text-align: center;">
                          Thank you for your interest in the <strong>StudyBuddy Android App!</strong>
                        </p>
                        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
                          <p style="margin: 0; color: #166534; font-size: 16px; font-weight: 500; line-height: 1.6;">
                            ✅ Your email <strong>${email}</strong> has been added to our waitlist.
                          </p>
                        </div>
                        <p style="margin: 20px 0 0; color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center;">
                          We'll notify you as soon as the app is ready for download. In the meantime, you can use the <strong>web version</strong> to get started with your studies!
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 40px 30px; text-align: center;">
                        <a href="${process.env.CLIENT_URL || 'https://sbd.satym.in'}" style="display: inline-block; background-color: #6366f1; color: #ffffff; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
                          Try Web Version →
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
    console.log(`📧 Waitlist confirmation email sent to ${email}`);
  } catch (error: any) {
    console.error('⚠️  Waitlist email error:', error.message);
    throw error;
  }
}
