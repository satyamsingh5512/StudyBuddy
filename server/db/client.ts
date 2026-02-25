import { MongoClient } from 'mongodb';

// Ensure MONGODB_URI is available
if (!process.env.MONGODB_URI) {
    throw new Error('Please add your Mongo URI to .env');
}

const uri = process.env.MONGODB_URI;

// Connection pooling options defined by the new standards
const options = {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Logic to prevent multiple instances of MongoClient in development/serverless
declare global {
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

/**
 * Get the underlying MongoClient instance
 * @returns {Promise<MongoClient>} - Resolves with the connected client
 */
export async function getClient(): Promise<MongoClient> {
    return await clientPromise;
}

/**
 * Get the default database instance
 * @returns {import("mongodb").Db} - The MongoDB database
 */
export async function getDb() {
    const client = await getClient();
    return client.db(); // Uses the database name from the connection string
}

/**
 * Close the connection pool
 */
export async function closeDb() {
    if (client) {
        await client.close();
    }
}
