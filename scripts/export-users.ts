/**
 * Export all user details to JSON file
 * Usage: npm run db:export-users
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { getMongoDb } from '../server/lib/mongodb';

async function exportUsers() {
  console.log('📥 Exporting user data...\n');

  try {
    const db = await getMongoDb();
    if (!db) {
      throw new Error('Failed to connect to database');
    }

    // Fetch all users
    const users = await db.collection('users').find({}).toArray();

    console.log(`✅ Found ${users.length} users\n`);

    // Format the data
    const exportData = {
      exportDate: new Date().toISOString(),
      totalUsers: users.length,
      users: users.map(user => ({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        username: user.username,
        emailVerified: user.emailVerified,
        googleId: user.googleId,
        avatar: user.avatar,
        avatarType: user.avatarType,
        onboardingDone: user.onboardingDone,
        examGoal: user.examGoal,
        examDate: user.examDate,
        examAttempt: user.examAttempt,
        studentClass: user.studentClass,
        batch: user.batch,
        syllabus: user.syllabus,
        totalPoints: user.totalPoints,
        totalStudyMinutes: user.totalStudyMinutes,
        streak: user.streak,
        lastActive: user.lastActive,
        showProfile: user.showProfile,
        createdAt: user.createdAt,
      }))
    };

    // Create backups directory if it doesn't exist
    if (!existsSync('backups')) {
      mkdirSync('backups', { recursive: true });
      console.log('📁 Created backups directory\n');
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `users-export-${timestamp}.json`;
    const filepath = `backups/${filename}`;

    // Write to file
    writeFileSync(filepath, JSON.stringify(exportData, null, 2));

    console.log(`✅ User data exported successfully!`);
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Total users: ${users.length}`);
    console.log(`\n📋 Summary:`);
    console.log(`   - Verified users: ${users.filter(u => u.emailVerified).length}`);
    console.log(`   - Google users: ${users.filter(u => u.googleId).length}`);
    console.log(`   - Email users: ${users.filter(u => u.password).length}`);
    console.log(`   - Completed onboarding: ${users.filter(u => u.onboardingDone).length}`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  }
}

exportUsers();
