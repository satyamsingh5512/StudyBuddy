/**
 * MongoDB Indexes for StudyBuddy
 * 
 * OPTIMIZATION: Add critical indexes for frequently queried fields
 * 
 * RUN THIS MIGRATION:
 * ```javascript
 * // In MongoDB shell or use MongoDB Compass
 * db.users.createIndex({ email: 1 }, { unique: true })
 * db.users.createIndex({ username: 1 }, { unique: true })
 * db.users.createIndex({ lastActive: -1 })
 * db.users.createIndex({ totalPoints: -1 })
 * 
 * db.todos.createIndex({ userId: 1 })
 * db.todos.createIndex({ userId: 1, dueDate: -1 })
 * db.todos.createIndex({ userId: 1, scheduledDate: -1 })
 * db.todos.createIndex({ userId: 1, completed: 1 })
 * db.todos.createIndex({ userId: 1, scheduledDate: -1, completed: 1 })
 * 
 * db.timer_sessions.createIndex({ userId: 1 })
 * db.timer_sessions.createIndex({ userId: 1, startTime: -1 })
 * db.timer_sessions.createIndex({ userId: 1, createdAt: -1 })
 * 
 * db.daily_reports.createIndex({ userId: 1, date: -1 })
 * 
 * db.messages.createIndex({ userId: 1 })
 * db.messages.createIndex({ toUserId: 1 })
 * db.messages.createIndex({ createdAt: -1 })
 * 
 * db.notes.createIndex({ userId: 1 })
 * db.notes.createIndex({ userId: 1, pinned: -1 })
 * db.notes.createIndex({ userId: 1, createdAt: -1 })
 * ```
 */

const MONGODB_INDEXES = `
// ============================================================================
// USERS COLLECTION
// ============================================================================

// Email lookup (login, password reset)
db.users.createIndex({ email: 1 }, { unique: true, name: 'idx_users_email' })

// Username lookup (profile, search)
db.users.createIndex({ username: 1 }, { unique: true, name: 'idx_users_username' })

// Last active for online status and stats
db.users.createIndex({ lastActive: -1 }, { name: 'idx_users_lastActive' })

// Points leaderboard
db.users.createIndex({ totalPoints: -1 }, { name: 'idx_users_totalPoints' })

// Onboarding status
db.users.createIndex({ onboardingDone: 1 }, { name: 'idx_users_onboarding' })

// ============================================================================
// TODOS COLLECTION
// ============================================================================

// User's todos (most frequent query)
db.todos.createIndex({ userId: 1 }, { name: 'idx_todos_userId' })

// Due date queries (overdue, daily tasks)
db.todos.createIndex({ userId: 1, dueDate: -1 }, { name: 'idx_todos_userId_dueDate' })

// Scheduled date queries (planning)
db.todos.createIndex({ userId: 1, scheduledDate: -1 }, { name: 'idx_todos_userId_scheduledDate' })

// Completed status (completed vs pending)
db.todos.createIndex({ userId: 1, completed: 1 }, { name: 'idx_todos_userId_completed' })

// Combined queries (daily planning with status)
db.todos.createIndex({ userId: 1, scheduledDate: -1, completed: 1 }, { name: 'idx_todos_userId_scheduled_completed' })

// Difficult queries with text search support (future)
// db.todos.createIndex({ title: 'text', subject: 'text' }, { name: 'idx_todos_text' })

// ============================================================================
// TIMER SESSIONS COLLECTION
// ============================================================================

// User's timer sessions
db.timer_sessions.createIndex({ userId: 1 }, { name: 'idx_timer_userId' })

// Start time for analytics
db.timer_sessions.createIndex({ userId: 1, startTime: -1 }, { name: 'idx_timer_userId_startTime' })

// Created at for fallback time range
db.timer_sessions.createIndex({ userId: 1, createdAt: -1 }, { name: 'idx_timer_userId_createdAt' })

// Duration for filtering
db.timer_sessions.createIndex({ userId: 1, duration: -1 }, { name: 'idx_timer_userId_duration' })

// ============================================================================
// DAILY REPORTS COLLECTION
// ============================================================================

// User's reports with date range queries
db.daily_reports.createIndex({ userId: 1, date: -1 }, { name: 'idx_reports_userId_date' })

// ============================================================================
// MESSAGES COLLECTION
// ============================================================================

// User's sent/received messages
db.messages.createIndex({ userId: 1 }, { name: 'idx_messages_userId' })

// Messages to specific user
db.messages.createIndex({ toUserId: 1 }, { name: 'idx_messages_toUserId' })

// Timestamp for chronological order
db.messages.createIndex({ createdAt: -1 }, { name: 'idx_messages_createdAt' })

// ============================================================================
// NOTES COLLECTION
// ============================================================================

// User's notes
db.notes.createIndex({ userId: 1 }, { name: 'idx_notes_userId' })

// Pinned notes first
db.notes.createIndex({ userId: 1, pinned: -1 }, { name: 'idx_notes_userId_pinned' })

// Created at for chronological order
db.notes.createIndex({ userId: 1, createdAt: -1 }, { name: 'idx_notes_userId_createdAt' })

// Color tag filtering
db.notes.createIndex({ userId: 1, color: 1 }, { name: 'idx_notes_userId_color' })

// Tags search (array field)
db.notes.createIndex({ userId: 1, tags: 1 }, { name: 'idx_notes_userId_tags' })
`

export default MONGODB_INDEXES;

/**
 * To apply these indexes:
 * 
 * Option 1: Using MongoDB Compass
 * 1. Connect to your MongoDB
 * 2. Select the 'studybuddy' database
 * 3. For each collection, click "Indexes" tab
 * 4. Click "Add Index" and paste the index definition
 * 
 * Option 2: Using MongoDB Shell (mongosh)
 * Run the commands above in mongosh
 * 
 * Option 3: Add to application startup (NOT recommended for production)
 * See backend/internal/config/db.ts for where to add indexes
 */
