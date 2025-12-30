/**
 * WebSocket Benchmark Script
 * File: tests/ws/ws_bench.js
 * 
 * Tests Socket.IO connection handling and message throughput.
 * 
 * Install: npm install socket.io-client
 * Usage: node tests/ws/ws_bench.js [url] [connections] [duration]
 * 
 * Example:
 *   node tests/ws/ws_bench.js http://localhost:3001 100 30
 */

const { io } = require('socket.io-client');

// Configuration
const URL = process.argv[2] || 'http://localhost:3001';
const NUM_CONNECTIONS = parseInt(process.argv[3]) || 50;
const DURATION_SECONDS = parseInt(process.argv[4]) || 30;
const MESSAGES_PER_SECOND = 2; // Per connection

// Metrics
const metrics = {
  connectionsAttempted: 0,
  connectionsSuccessful: 0,
  connectionsFailed: 0,
  messagesSent: 0,
  messagesReceived: 0,
  errors: 0,
  latencies: [],
  startTime: null,
  endTime: null,
};

const sockets = [];
const pendingMessages = new Map(); // messageId -> timestamp

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔌 WebSocket Benchmark');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`URL: ${URL}`);
console.log(`Connections: ${NUM_CONNECTIONS}`);
console.log(`Duration: ${DURATION_SECONDS}s`);
console.log(`Messages/sec/connection: ${MESSAGES_PER_SECOND}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Create a single connection
function createConnection(index) {
  return new Promise((resolve) => {
    metrics.connectionsAttempted++;
    
    const socket = io(URL, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    const userId = `bench-user-${index}-${Date.now()}`;

    socket.on('connect', () => {
      metrics.connectionsSuccessful++;
      socket.emit('join-chat', userId);
      sockets.push(socket);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      metrics.connectionsFailed++;
      metrics.errors++;
      console.error(`Connection ${index} failed:`, err.message);
      resolve(null);
    });

    socket.on('new-message', (msg) => {
      metrics.messagesReceived++;
      
      // Calculate latency if this is our message
      if (msg.message && msg.message.startsWith('bench-')) {
        const msgId = msg.message;
        const sentTime = pendingMessages.get(msgId);
        if (sentTime) {
          const latency = Date.now() - sentTime;
          metrics.latencies.push(latency);
          pendingMessages.delete(msgId);
        }
      }
    });

    socket.on('rate-limit', () => {
      // Expected during high load
    });

    socket.on('error', () => {
      metrics.errors++;
    });

    socket.on('disconnect', () => {
      const idx = sockets.indexOf(socket);
      if (idx > -1) sockets.splice(idx, 1);
    });

    // Timeout for connection
    setTimeout(() => {
      if (!socket.connected) {
        metrics.connectionsFailed++;
        socket.close();
        resolve(null);
      }
    }, 10000);
  });
}

// Send messages from all connections
function sendMessages() {
  for (const socket of sockets) {
    if (socket.connected) {
      const msgId = `bench-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      pendingMessages.set(msgId, Date.now());
      socket.emit('send-message', { message: msgId });
      metrics.messagesSent++;
    }
  }
}

// Calculate statistics
function calculateStats() {
  const sorted = [...metrics.latencies].sort((a, b) => a - b);
  const len = sorted.length;
  
  return {
    count: len,
    min: len > 0 ? sorted[0] : 0,
    max: len > 0 ? sorted[len - 1] : 0,
    avg: len > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / len) : 0,
    p50: len > 0 ? sorted[Math.floor(len * 0.5)] : 0,
    p95: len > 0 ? sorted[Math.floor(len * 0.95)] : 0,
    p99: len > 0 ? sorted[Math.floor(len * 0.99)] : 0,
  };
}

// Print results
function printResults() {
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const stats = calculateStats();
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Results');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Connections:');
  console.log(`  Attempted:  ${metrics.connectionsAttempted}`);
  console.log(`  Successful: ${metrics.connectionsSuccessful}`);
  console.log(`  Failed:     ${metrics.connectionsFailed}`);
  console.log('');
  console.log('Messages:');
  console.log(`  Sent:       ${metrics.messagesSent}`);
  console.log(`  Received:   ${metrics.messagesReceived}`);
  console.log(`  Throughput: ${Math.round(metrics.messagesSent / duration)} msg/s (sent)`);
  console.log(`  Throughput: ${Math.round(metrics.messagesReceived / duration)} msg/s (received)`);
  console.log('');
  console.log('Latency (ms):');
  console.log(`  Min:  ${stats.min}`);
  console.log(`  Avg:  ${stats.avg}`);
  console.log(`  p50:  ${stats.p50}`);
  console.log(`  p95:  ${stats.p95}`);
  console.log(`  p99:  ${stats.p99}`);
  console.log(`  Max:  ${stats.max}`);
  console.log('');
  console.log('Errors:', metrics.errors);
  console.log('Duration:', duration.toFixed(1), 'seconds');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // SLO check
  console.log('');
  console.log('🎯 SLO Check:');
  console.log(`  p95 < 500ms: ${stats.p95 < 500 ? '✅ PASS' : '❌ FAIL'} (${stats.p95}ms)`);
  console.log(`  Error rate < 5%: ${(metrics.errors / metrics.messagesSent * 100) < 5 ? '✅ PASS' : '❌ FAIL'} (${(metrics.errors / metrics.messagesSent * 100).toFixed(2)}%)`);
  console.log(`  Connection success > 95%: ${(metrics.connectionsSuccessful / metrics.connectionsAttempted * 100) > 95 ? '✅ PASS' : '❌ FAIL'} (${(metrics.connectionsSuccessful / metrics.connectionsAttempted * 100).toFixed(1)}%)`);
}

// Main execution
async function main() {
  console.log('🔄 Establishing connections...');
  
  // Create connections in batches to avoid overwhelming the server
  const batchSize = 10;
  for (let i = 0; i < NUM_CONNECTIONS; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, NUM_CONNECTIONS); j++) {
      batch.push(createConnection(j));
    }
    await Promise.all(batch);
    process.stdout.write(`\r  Connected: ${metrics.connectionsSuccessful}/${NUM_CONNECTIONS}`);
  }
  
  console.log('');
  console.log(`✅ ${metrics.connectionsSuccessful} connections established`);
  console.log('');
  console.log('📤 Starting message load...');
  
  metrics.startTime = Date.now();
  
  // Send messages at specified rate
  const messageInterval = setInterval(() => {
    sendMessages();
  }, 1000 / MESSAGES_PER_SECOND);
  
  // Progress indicator
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - metrics.startTime) / 1000;
    const remaining = DURATION_SECONDS - elapsed;
    process.stdout.write(`\r  Time remaining: ${Math.ceil(remaining)}s | Sent: ${metrics.messagesSent} | Received: ${metrics.messagesReceived}`);
  }, 1000);
  
  // Stop after duration
  setTimeout(() => {
    clearInterval(messageInterval);
    clearInterval(progressInterval);
    metrics.endTime = Date.now();
    
    console.log('');
    console.log('');
    console.log('🛑 Stopping...');
    
    // Wait for pending messages
    setTimeout(() => {
      // Close all connections
      for (const socket of sockets) {
        socket.close();
      }
      
      printResults();
      process.exit(0);
    }, 2000);
  }, DURATION_SECONDS * 1000);
}

main().catch(console.error);
