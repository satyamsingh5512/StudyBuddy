#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

console.log('\n🔍 StudyBuddy Configuration Check\n');
console.log('='.repeat(50));

const checks = [
  {
    name: 'Database URL',
    key: 'DATABASE_URL',
    required: true,
    check: (val) => val && !val.includes('user:password'),
  },
  {
    name: 'Google Client ID',
    key: 'GOOGLE_CLIENT_ID',
    required: true,
    check: (val) => val && val !== 'your-google-client-id',
  },
  {
    name: 'Google Client Secret',
    key: 'GOOGLE_CLIENT_SECRET',
    required: true,
    check: (val) => val && val !== 'your-google-client-secret',
  },
  {
    name: 'Session Secret',
    key: 'SESSION_SECRET',
    required: true,
    check: (val) => val && val !== 'change-this-to-a-random-secret-in-production',
  },
  {
    name: 'Gemini API Key',
    key: 'GEMINI_API_KEY',
    required: false,
    check: (val) => val && val !== 'your-gemini-api-key',
  },
];

let allGood = true;

checks.forEach((check) => {
  const value = process.env[check.key];
  const isValid = check.check(value);
  const status = isValid ? '✅' : check.required ? '❌' : '⚠️ ';

  if (!isValid && check.required) {
    allGood = false;
  }

  console.log(`${status} ${check.name}`);
  if (!isValid && check.required) {
    console.log(`   Missing or invalid: ${check.key}`);
  }
});

console.log('='.repeat(50));

if (allGood) {
  console.log('\n✅ All required configuration is set!');
  console.log('\nNext steps:');
  console.log('1. Run: npm run db:push');
  console.log('2. Run: npm run dev');
  console.log('3. Open: http://localhost:5173\n');
} else {
  console.log('\n❌ Some required configuration is missing.');
  console.log('\nPlease update your .env file with the missing values.');
  console.log('See QUICKSTART.md for detailed instructions.\n');
}
