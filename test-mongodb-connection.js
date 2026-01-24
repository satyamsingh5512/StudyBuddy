const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

console.log('Testing MongoDB Connection...');
console.log('URI:', uri?.replace(/:[^:@]+@/, ':****@')); // Hide password

async function testConnection() {
  const client = new MongoClient(uri, {
    tls: true,
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,
    serverSelectionTimeoutMS: 10000,
  });

  try {
    console.log('\n🔄 Attempting to connect...');
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!');
    
    const db = client.db();
    console.log('📦 Database name:', db.databaseName);
    
    const collections = await db.listCollections().toArray();
    console.log('📚 Collections:', collections.length > 0 ? collections.map(c => c.name).join(', ') : 'No collections yet');
    
    // Test write
    const testCollection = db.collection('connection_test');
    await testCollection.insertOne({ test: true, timestamp: new Date() });
    console.log('✅ Write test successful');
    
    // Test read
    const doc = await testCollection.findOne({ test: true });
    console.log('✅ Read test successful');
    
    // Cleanup
    await testCollection.deleteOne({ test: true });
    console.log('✅ Cleanup successful');
    
    await client.close();
    console.log('\n✅ All tests passed! MongoDB is working correctly.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('authentication failed')) {
      console.error('\n💡 Fix: Check your username and password in MongoDB Atlas');
      console.error('   1. Go to Database Access in MongoDB Atlas');
      console.error('   2. Verify user exists and password is correct');
      console.error('   3. Make sure user has "Read and write" permissions');
    } else if (error.message.includes('TLS') || error.message.includes('SSL')) {
      console.error('\n💡 Fix: TLS/SSL issue detected');
      console.error('   1. Try creating a new MongoDB Atlas cluster');
      console.error('   2. Or use MongoDB locally: mongodb://localhost:27017/studybuddy');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('\n💡 Fix: Cannot reach MongoDB server');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify the cluster URL is correct');
    } else if (error.message.includes('IP')) {
      console.error('\n💡 Fix: IP not whitelisted');
      console.error('   1. Go to Network Access in MongoDB Atlas');
      console.error('   2. Add your IP or use 0.0.0.0/0 for testing');
    }
    
    console.error('\nFull error details:');
    console.error(error);
    process.exit(1);
  }
}

testConnection();
