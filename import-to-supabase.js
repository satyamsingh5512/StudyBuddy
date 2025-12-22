import { PrismaClient } from '@prisma/client';
import fs from 'fs';

// This script imports data TO Supabase
// Run this AFTER changing DATABASE_URL to Supabase and running prisma db push

const prisma = new PrismaClient();

async function importData() {
  console.log('🔄 Importing data to Supabase...\n');
  
  if (!fs.existsSync('./database-backup.json')) {
    console.error('❌ Backup file not found!');
    console.log('   Run: node migrate-to-supabase.js (with old DATABASE_URL)');
    return;
  }
  
  const data = JSON.parse(fs.readFileSync('./database-backup.json', 'utf-8'));
  
  try {
    // Import in order (respecting foreign keys)
    
    // 1. Schools, Colleges, Coachings (no dependencies)
    if (data.schools?.length > 0) {
      console.log('📦 Importing schools...');
      for (const item of data.schools) {
        await prisma.school.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.schools.length} schools`);
    }
    
    if (data.colleges?.length > 0) {
      console.log('📦 Importing colleges...');
      for (const item of data.colleges) {
        await prisma.college.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.colleges.length} colleges`);
    }
    
    if (data.coachings?.length > 0) {
      console.log('📦 Importing coachings...');
      for (const item of data.coachings) {
        await prisma.coaching.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.coachings.length} coachings`);
    }
    
    // 2. Users (depends on schools, colleges, coachings)
    if (data.users?.length > 0) {
      console.log('📦 Importing users...');
      for (const item of data.users) {
        await prisma.user.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.users.length} users`);
    }
    
    // 3. User-dependent tables
    const userTables = [
      { name: 'todos', model: prisma.todo },
      { name: 'dailyReports', model: prisma.dailyReport },
      { name: 'timerSessions', model: prisma.timerSession },
      { name: 'schedules', model: prisma.schedule },
      { name: 'chatMessages', model: prisma.chatMessage },
    ];
    
    for (const table of userTables) {
      if (data[table.name]?.length > 0) {
        console.log(`📦 Importing ${table.name}...`);
        for (const item of data[table.name]) {
          await table.model.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
        console.log(`   ✅ ${data[table.name].length} records`);
      }
    }
    
    // 4. Message tables
    if (data.schoolMessages?.length > 0) {
      console.log('📦 Importing schoolMessages...');
      for (const item of data.schoolMessages) {
        await prisma.schoolMessage.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.schoolMessages.length} records`);
    }
    
    if (data.collegeMessages?.length > 0) {
      console.log('📦 Importing collegeMessages...');
      for (const item of data.collegeMessages) {
        await prisma.collegeMessage.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.collegeMessages.length} records`);
    }
    
    if (data.coachingMessages?.length > 0) {
      console.log('📦 Importing coachingMessages...');
      for (const item of data.coachingMessages) {
        await prisma.coachingMessage.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.coachingMessages.length} records`);
    }
    
    // 5. Friend system
    if (data.friendships?.length > 0) {
      console.log('📦 Importing friendships...');
      for (const item of data.friendships) {
        await prisma.friendship.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.friendships.length} records`);
    }
    
    if (data.directMessages?.length > 0) {
      console.log('📦 Importing directMessages...');
      for (const item of data.directMessages) {
        await prisma.directMessage.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.directMessages.length} records`);
    }
    
    if (data.blocks?.length > 0) {
      console.log('📦 Importing blocks...');
      for (const item of data.blocks) {
        await prisma.block.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.blocks.length} records`);
    }
    
    // 6. FAQs and Notices
    if (data.faqs?.length > 0) {
      console.log('📦 Importing FAQs...');
      for (const item of data.faqs) {
        await prisma.fAQ.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.faqs.length} records`);
    }
    
    if (data.notices?.length > 0) {
      console.log('📦 Importing notices...');
      for (const item of data.notices) {
        await prisma.notice.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.notices.length} records`);
    }
    
    // 7. Forms system
    if (data.forms?.length > 0) {
      console.log('📦 Importing forms...');
      for (const item of data.forms) {
        await prisma.form.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      console.log(`   ✅ ${data.forms.length} records`);
    }
    
    const formTables = [
      { name: 'formSections', model: prisma.formSection },
      { name: 'formFields', model: prisma.formField },
      { name: 'formResponses', model: prisma.formResponse },
      { name: 'formAnswers', model: prisma.formAnswer },
      { name: 'formCollaborators', model: prisma.formCollaborator },
      { name: 'webhookLogs', model: prisma.webhookLog },
      { name: 'formActivityLogs', model: prisma.formActivityLog },
    ];
    
    for (const table of formTables) {
      if (data[table.name]?.length > 0) {
        console.log(`📦 Importing ${table.name}...`);
        for (const item of data[table.name]) {
          await table.model.upsert({
            where: { id: item.id },
            update: item,
            create: item
          });
        }
        console.log(`   ✅ ${data[table.name].length} records`);
      }
    }
    
    console.log('\n✅ Import complete!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importData();
