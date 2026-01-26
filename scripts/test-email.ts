/**
 * Test email configuration with Resend
 * Run: npx tsx --env-file=.env scripts/test-email.ts
 */
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

async function testEmail() {
  console.log('🔍 Testing Resend Email Configuration...\n');

  // Check environment variables
  console.log('Environment Variables:');
  console.log('  RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('  EMAIL_FROM:', process.env.EMAIL_FROM || '❌ Not set');
  console.log('');

  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not configured!');
    console.error('\nTo get your API key:');
    console.error('1. Go to https://resend.com/api-keys');
    console.error('2. Create a new API key');
    console.error('3. Add to .env: RESEND_API_KEY=re_...');
    process.exit(1);
  }

  // Create Resend instance
  console.log('📧 Creating Resend client...');
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Send test email
  const testOTP = '123456';
  const testEmail = process.env.TEST_EMAIL || 'delivered@resend.dev'; // Resend test email

  console.log(`📨 Sending test email to ${testEmail}...`);
  
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'StudyBuddy <onboarding@resend.dev>',
      to: testEmail,
      subject: 'Test Email - StudyBuddy',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Test Email</title>
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
                        <h2 style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 600;">Email Test Successful! ✅</h2>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 40px 30px;">
                        <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.5;">
                          Your Resend email configuration is working correctly!<br><br>
                          Test OTP:
                        </p>
                        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 20px 0;">
                          <div style="font-size: 36px; font-weight: 700; color: #6366f1; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${testOTP}
                          </div>
                        </div>
                        <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                          This is a test email. Your Resend configuration is working properly.
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

    if (error) {
      console.error('❌ Failed to send test email:', error);
      process.exit(1);
    }

    console.log('✅ Test email sent successfully!');
    console.log('   Email ID:', data?.id);
    console.log('\n📬 Check your inbox:', testEmail);
    console.log('   (Resend test emails go to delivered@resend.dev)\n');
  } catch (error: any) {
    console.error('❌ Failed to send test email:', error.message);
    process.exit(1);
  }
}

testEmail().catch(console.error);
