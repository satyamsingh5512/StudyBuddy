/**
 * Vercel Serverless Function Entry Point
 * This wraps the Express app for Vercel deployment
 */

import 'dotenv/config';

// Import the Express app (we'll need to export it from server/index.ts)
import app from '../server/app.js';

export default app;
