import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

console.log('Testing Email Configuration...\n');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '****' + process.env.SMTP_PASS.slice(-4) : 'NOT SET');
console.log('');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function testEmail() {
  try {
    console.log('🔄 Sending test email...\n');
    
    const info = await transporter.sendMail({
      from: `"StudyBuddy Test" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Send to yourself
      subject: 'Test Email from StudyBuddy',
      text: 'If you receive this email, your SMTP configuration is working correctly!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #6366f1;">✅ Success!</h2>
          <p>Your SMTP configuration is working correctly.</p>
          <p>You can now receive OTP codes via email.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            This is a test email from StudyBuddy
          </p>
        </div>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('\n📧 Check your inbox:', process.env.SMTP_USER);
    console.log('\n🎉 SMTP is configured correctly!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to send email\n');
    console.error('Error:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.error('\n💡 Fix: Your Gmail app password is incorrect or expired');
      console.error('   1. Go to https://myaccount.google.com/apppasswords');
      console.error('   2. Generate a NEW app password');
      console.error('   3. Update SMTP_PASS in .env file');
      console.error('   4. Remove all spaces from the password');
    } else if (error.message.includes('Missing credentials')) {
      console.error('\n💡 Fix: SMTP credentials not found');
      console.error('   1. Check .env file has SMTP_USER and SMTP_PASS');
      console.error('   2. Make sure .env file is in the project root');
      console.error('   3. Restart the server after updating .env');
    }
    
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  }
}

testEmail();
