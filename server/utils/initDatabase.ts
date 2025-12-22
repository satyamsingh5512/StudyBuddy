import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

export async function initializeDatabase() {
  try {
    console.log('🔄 Checking database connection...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Check if tables exist by trying to count users
    try {
      await prisma.user.count();
      console.log('✅ Database schema exists');
    } catch (error: any) {
      // If table doesn't exist, push the schema
      if (error.code === 'P2021' || error.message.includes('does not exist')) {
        console.log('⚠️  Database schema not found, creating...');
        
        try {
          // Run prisma db push
          const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss --skip-generate');
          console.log(stdout);
          if (stderr) console.error(stderr);
          console.log('✅ Database schema created successfully');
        } catch (pushError: any) {
          console.error('❌ Failed to create database schema:', pushError.message);
          throw pushError;
        }
      } else {
        throw error;
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}
