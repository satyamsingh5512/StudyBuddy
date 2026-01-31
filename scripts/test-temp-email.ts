/**
 * Test script for temporary email detection
 * Usage: npm run test:temp-email
 */

import { isTempEmail, isValidPermanentEmail } from '../server/lib/emailValidator';

const testEmails = [
  // Valid permanent emails
  { email: 'user@gmail.com', expected: false },
  { email: 'admin@studybuddy.com', expected: false },
  { email: 'test@outlook.com', expected: false },
  { email: 'student@university.edu', expected: false },

  // Temporary emails
  { email: 'test@mailinator.com', expected: true },
  { email: 'user@10minutemail.com', expected: true },
  { email: 'fake@guerrillamail.com', expected: true },
  { email: 'temp@yopmail.com', expected: true },
  { email: 'test@tempmail.com', expected: true },
  { email: 'user@trashmail.com', expected: true },
  { email: 'test@fakeinbox.com', expected: true },

  // Pattern-based temp emails
  { email: 'user@123mail.com', expected: true },
  { email: 'test@temp-email.org', expected: true },
  { email: 'fake@trash-mail.com', expected: true },
];

console.log('🧪 Testing temporary email detection...\n');

let passed = 0;
let failed = 0;

for (const test of testEmails) {
  const result = isTempEmail(test.email);
  const status = result === test.expected ? '✅' : '❌';

  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }

  console.log(`${status} ${test.email} - Expected: ${test.expected ? 'TEMP' : 'VALID'}, Got: ${result ? 'TEMP' : 'VALID'}`);
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testEmails.length} tests`);

if (failed === 0) {
  console.log('✅ All tests passed!');
} else {
  console.log('❌ Some tests failed!');
  process.exit(1);
}
