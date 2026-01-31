/**
 * Test script for admin daily stats email
 * Usage: npm run test:admin-email
 */

import { sendDailyStatsEmail } from '../server/lib/email';

const testStats = {
  completedTodos: 8,
  totalTodos: 10,
  completedSchedules: 5,
  totalSchedules: 6,
  studyMinutes: 145,
  streak: 7,
  totalPoints: 2450
};

async function testAdminEmail() {
  console.log('🧪 Testing admin daily stats email...\n');

  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testName = 'Test User';

  console.log(`📧 Sending test email to: ${testEmail}`);
  console.log(`📊 Test stats:`, testStats);

  try {
    await sendDailyStatsEmail(testEmail, testName, testStats);
    console.log('\n✅ Test email sent successfully!');
    console.log('Check your inbox for the daily stats email.');
  } catch (error: any) {
    console.error('\n❌ Failed to send test email:', error.message);
    process.exit(1);
  }
}

testAdminEmail();
