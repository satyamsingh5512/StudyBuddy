-- Performance Indexes for StudyBuddy
-- File: infra/migrations/001_add_indexes.sql
-- 
-- Run with: npx prisma db execute --file infra/migrations/001_add_indexes.sql
-- Or via CockroachDB CLI: cockroach sql --url $DATABASE_URL < infra/migrations/001_add_indexes.sql
--
-- IMPORTANT: These are CREATE INDEX CONCURRENTLY equivalents for CockroachDB
-- They won't block writes during creation

-- ============================================
-- DirectMessage Indexes (Critical for chat performance)
-- ============================================

-- Composite index for conversation queries (sender + receiver + time)
-- Covers: GET /api/messages/:userId, GET /api/messages/conversations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_direct_message_conversation 
ON "DirectMessage" ("senderId", "receiverId", "createdAt" DESC);

-- Index for unread message counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_direct_message_unread 
ON "DirectMessage" ("receiverId", "read") 
WHERE read = false;

-- ============================================
-- Friendship Indexes (Critical for friend operations)
-- ============================================

-- Composite index for friendship lookups by both parties
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friendship_sender_status 
ON "Friendship" ("senderId", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_friendship_receiver_status 
ON "Friendship" ("receiverId", "status");

-- ============================================
-- ChatMessage Indexes (Real-time chat)
-- ============================================

-- Index for recent messages (global chat)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_message_recent 
ON "ChatMessage" ("createdAt" DESC);

-- ============================================
-- TimerSession Indexes (Analytics)
-- ============================================

-- Composite index for user analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timer_session_analytics 
ON "TimerSession" ("userId", "completedAt" DESC);

-- Index for date-range analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timer_session_date 
ON "TimerSession" ("completedAt" DESC);

-- ============================================
-- DailyReport Indexes (Analytics)
-- ============================================

-- Composite index for user daily reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_report_user_date 
ON "DailyReport" ("userId", "date" DESC);

-- ============================================
-- Todo Indexes
-- ============================================

-- Index for user todos (already has userId index, add completion filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_todo_user_completed 
ON "Todo" ("userId", "completed", "createdAt" DESC);

-- ============================================
-- Schedule Indexes
-- ============================================

-- Composite index for schedule queries by date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_user_date_range 
ON "Schedule" ("userId", "date" DESC, "startTime");

-- ============================================
-- User Indexes (Leaderboard)
-- ============================================

-- Index for leaderboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_leaderboard 
ON "app_users" ("totalPoints" DESC);

-- Index for username search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_username_search 
ON "app_users" ("username") 
WHERE username IS NOT NULL;

-- ============================================
-- Block Indexes
-- ============================================

-- Composite index for block checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_block_both_parties 
ON "Block" ("blockerId", "blockedId");

-- ============================================
-- Session Cleanup Index
-- ============================================

-- Index for expired session cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_expires 
ON "Session" ("expiresAt");

-- ============================================
-- Verification Queries
-- ============================================

-- Run these to verify indexes were created:
-- SHOW INDEXES FROM "DirectMessage";
-- SHOW INDEXES FROM "Friendship";
-- SHOW INDEXES FROM "ChatMessage";
-- SHOW INDEXES FROM "TimerSession";
-- SHOW INDEXES FROM "app_users";
