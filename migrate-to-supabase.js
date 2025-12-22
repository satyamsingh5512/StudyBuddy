import { PrismaClient } from '@prisma/client';
import fs from 'fs';

// This script exports data from your current database
// Run this BEFORE changing DATABASE_URL to Supabase

const prisma = new PrismaClient();

async function exportData() {
  console.log('🔄 Exporting data from current database...\n');
  
  const data = {};
  
  try {
    // Export all tables
    const tables = [
      { name: 'users', query: () => prisma.user.findMany() },
      { name: 'schools', query: () => prisma.school.findMany() },
      { name: 'colleges', query: () => prisma.college.findMany() },
      { name: 'coachings', query: () => prisma.coaching.findMany() },
      { name: 'todos', query: () => prisma.todo.findMany() },
      { name: 'dailyReports', query: () => prisma.dailyReport.findMany() },
      { name: 'timerSessions', query: () => prisma.timerSession.findMany() },
      { name: 'schedules', query: () => prisma.schedule.findMany() },
      { name: 'chatMessages', query: () => prisma.chatMessage.findMany() },
      { name: 'schoolMessages', query: () => prisma.schoolMessage.findMany() },
      { name: 'collegeMessages', query: () => prisma.collegeMessage.findMany() },
      { name: 'coachingMessages', query: () => prisma.coachingMessage.findMany() },
      { name: 'friendships', query: () => prisma.friendship.findMany() },
      { name: 'directMessages', query: () => prisma.directMessage.findMany() },
      { name: 'blocks', query: () => prisma.block.findMany() },
      { name: 'faqs', query: () => prisma.fAQ.findMany() },
      { name: 'notices', query: () => prisma.notice.findMany() },
      { name: 'forms', query: () => prisma.form.findMany() },
      { name: 'formSections', query: () => prisma.formSection.findMany() },
      { name: 'formFields', query: () => prisma.formField.findMany() },
      { name: 'formResponses', query: () => prisma.formResponse.findMany() },
      { name: 'formAnswers', query: () => prisma.formAnswer.findMany() },
      { name: 'formCollaborators', query: () => prisma.formCollaborator.findMany() },
      { name: 'webhookLogs', query: () => prisma.webhookLog.findMany() },
      { name: 'formActivityLogs', query: () => prisma.formActivityLog.findMany() },
    ];
    
    for (const table of tables) {
      console.log(`📦 Exporting ${table.name}...`);
      try {
        data[table.name] = await table.query();
        console.log(`   ✅ ${data[table.name].length} records`);
      } catch (e) {
        console.log(`   ⚠️  Skipped (table may not exist)`);
        data[table.name] = [];
      }
    }
    
    // Save backup
    fs.writeFileSync('./database-backup.json', JSON.stringify(data, null, 2));
    
    console.log('\n✅ Export complete!');
    console.log('📁 Backup saved to: ./database-backup.json');
    
    // Summary
    let total = 0;
    Object.values(data).forEach(arr => total += arr.length);
    console.log(`📊 Total records: ${total}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
