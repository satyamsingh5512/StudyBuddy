package middleware

import (
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type indexSpec struct {
	keys bson.D
	opts *options.IndexOptions
}

func indexSpecifications() map[string][]indexSpec {
	return map[string][]indexSpec{
		"users": {
			{bson.D{{Key: "email", Value: 1}}, options.Index().SetName("idx_users_email").SetUnique(true)},
			{bson.D{{Key: "username", Value: 1}}, options.Index().SetName("idx_users_username").SetUnique(true)},
			{bson.D{{Key: "lastActive", Value: -1}}, options.Index().SetName("idx_users_lastActive")},
			{bson.D{{Key: "totalPoints", Value: -1}}, options.Index().SetName("idx_users_totalPoints")},
		},
		"availabilities": {
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("uq_availabilities_userId").SetUnique(true)},
		},
		"schedules": {
			{bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_schedules_userId_date_createdAt")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_schedules_userId_createdAt")},
		},
		"todos": {
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("idx_todos_userId")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "dueDate", Value: -1}}, options.Index().SetName("idx_todos_userId_dueDate")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "scheduledDate", Value: -1}}, options.Index().SetName("idx_todos_userId_scheduledDate")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "completed", Value: 1}}, options.Index().SetName("idx_todos_userId_completed")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "completed", Value: 1}, {Key: "completedAt", Value: -1}}, options.Index().SetName("idx_todos_userId_completedAt")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "scheduledDate", Value: -1}, {Key: "completed", Value: 1}}, options.Index().SetName("idx_todos_userId_scheduled_completed")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "clientMutationId", Value: 1}}, options.Index().SetName("uq_todos_user_mutation").SetUnique(true).SetPartialFilterExpression(bson.M{"clientMutationId": bson.M{"$exists": true}})},
		},
		"timer_sessions": {
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("idx_timer_userId")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "startTime", Value: -1}}, options.Index().SetName("idx_timer_userId_startTime")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_timer_userId_createdAt")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "clientMutationId", Value: 1}}, options.Index().SetName("uq_timer_user_mutation").SetUnique(true).SetPartialFilterExpression(bson.M{"clientMutationId": bson.M{"$exists": true}})},
		},
		"focus_sessions": {
			{bson.D{{Key: "userId", Value: 1}, {Key: "active", Value: 1}, {Key: "heartbeatAt", Value: -1}}, options.Index().SetName("idx_focus_user_active_heartbeat")},
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("uq_focus_user_active").SetUnique(true).SetPartialFilterExpression(bson.M{"active": true})},
			{bson.D{{Key: "updatedAt", Value: 1}}, options.Index().SetName("ttl_focus_updated").SetExpireAfterSeconds(30 * 24 * 60 * 60)},
		},
		"daily_reports": {
			{bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: -1}}, options.Index().SetName("idx_reports_userId_date")},
		},
		"direct_messages": {
			{bson.D{{Key: "senderId", Value: 1}, {Key: "receiverId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_direct_messages_sender_receiver_created")},
			{bson.D{{Key: "receiverId", Value: 1}, {Key: "senderId", Value: 1}, {Key: "read", Value: 1}}, options.Index().SetName("idx_direct_messages_receiver_sender_read")},
		},
		"friend_requests": {
			{bson.D{{Key: "senderId", Value: 1}, {Key: "receiverId", Value: 1}}, options.Index().SetName("idx_friend_requests_pair")},
			{bson.D{{Key: "receiverId", Value: 1}, {Key: "status", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_friend_requests_receiver_status")},
			{bson.D{{Key: "senderId", Value: 1}, {Key: "status", Value: 1}}, options.Index().SetName("idx_friend_requests_sender_status")},
		},
		"blocks": {
			{bson.D{{Key: "blockerId", Value: 1}, {Key: "blockedId", Value: 1}}, options.Index().SetName("idx_blocks_pair").SetUnique(true)},
			{bson.D{{Key: "blockedId", Value: 1}, {Key: "blockerId", Value: 1}}, options.Index().SetName("idx_blocks_reverse_pair")},
		},
		"notes": {
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("idx_notes_userId")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "pinned", Value: -1}}, options.Index().SetName("idx_notes_userId_pinned")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_notes_userId_createdAt")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "color", Value: 1}}, options.Index().SetName("idx_notes_userId_color")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "tags", Value: 1}}, options.Index().SetName("idx_notes_userId_tags")},
		},
		"journal_entries": {
			{bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: 1}}, options.Index().SetName("uq_journal_entries_user_date").SetUnique(true)},
			{bson.D{{Key: "userId", Value: 1}, {Key: "updatedAt", Value: -1}}, options.Index().SetName("idx_journal_entries_user_updated")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "attachmentIds", Value: 1}}, options.Index().SetName("idx_journal_entries_user_attachments")},
		},
		"journal_attachments": {
			{bson.D{{Key: "userId", Value: 1}, {Key: "slot", Value: 1}}, options.Index().SetName("uq_journal_attachments_user_slot").SetUnique(true).SetPartialFilterExpression(bson.M{"slot": bson.M{"$exists": true}})},
			{bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_journal_attachments_user_created")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "deletionState", Value: 1}}, options.Index().SetName("idx_journal_attachments_user_deletion")},
		},
		"goals": {
			{bson.D{{Key: "userId", Value: 1}, {Key: "updatedAt", Value: -1}}, options.Index().SetName("idx_goals_userId_updatedAt")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "status", Value: 1}, {Key: "updatedAt", Value: -1}}, options.Index().SetName("idx_goals_userId_status_updatedAt")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_goals_userId_createdAt")},
		},
		"goal_completions": {
			{bson.D{{Key: "userId", Value: 1}, {Key: "goalId", Value: 1}, {Key: "subGoalId", Value: 1}, {Key: "date", Value: 1}}, options.Index().SetName("uq_goal_completions_user_goal_subgoal_date").SetUnique(true)},
			{bson.D{{Key: "userId", Value: 1}, {Key: "goalId", Value: 1}, {Key: "date", Value: 1}}, options.Index().SetName("idx_goal_completions_user_goal_date")},
		},
		"show_ups": {
			{bson.D{{Key: "userId", Value: 1}, {Key: "goalId", Value: 1}, {Key: "date", Value: 1}}, options.Index().SetName("uq_show_ups_user_goal_date").SetUnique(true)},
		},
		"goal_check_ins": {
			{bson.D{{Key: "userId", Value: 1}, {Key: "goalId", Value: 1}, {Key: "weekStart", Value: 1}}, options.Index().SetName("uq_goal_check_ins_user_goal_weekStart").SetUnique(true)},
		},
		// The waitlist route is public, so the address is the identity: a unique
		// index keeps concurrent upserts from inserting duplicate rows.
		"waitlist": {
			{bson.D{{Key: "email", Value: 1}}, options.Index().SetName("uq_waitlist_email").SetUnique(true)},
		},

		// ---- Study Rooms ----
		// One index per access path a handler actually uses. Discovery sorts on
		// denormalized counters, so those sorts must be indexed or Atlas M0 will
		// blocking-sort the whole collection.
		"study_rooms": {
			{bson.D{{Key: "slug", Value: 1}}, options.Index().SetName("uq_study_rooms_slug").SetUnique(true)},
			{bson.D{{Key: "archived", Value: 1}, {Key: "visibility", Value: 1}, {Key: "lastActivityAt", Value: -1}}, options.Index().SetName("idx_study_rooms_discovery")},
			{bson.D{{Key: "archived", Value: 1}, {Key: "visibility", Value: 1}, {Key: "memberCount", Value: -1}}, options.Index().SetName("idx_study_rooms_members")},
			{bson.D{{Key: "archived", Value: 1}, {Key: "visibility", Value: 1}, {Key: "totalStudyMinutes", Value: -1}}, options.Index().SetName("idx_study_rooms_hours")},
			{bson.D{{Key: "archived", Value: 1}, {Key: "category", Value: 1}, {Key: "lastActivityAt", Value: -1}}, options.Index().SetName("idx_study_rooms_category")},
			{bson.D{{Key: "tags", Value: 1}}, options.Index().SetName("idx_study_rooms_tags")},
			{bson.D{{Key: "ownerId", Value: 1}, {Key: "archived", Value: 1}}, options.Index().SetName("idx_study_rooms_owner")},
		},
		// (roomId,userId) is the authorization lookup on every room request and
		// must be unique: it is what makes concurrent joins idempotent.
		"room_members": {
			{bson.D{{Key: "roomId", Value: 1}, {Key: "userId", Value: 1}}, options.Index().SetName("uq_room_members_room_user").SetUnique(true)},
			{bson.D{{Key: "userId", Value: 1}, {Key: "status", Value: 1}, {Key: "lastSeenAt", Value: -1}}, options.Index().SetName("idx_room_members_user_status")},
			{bson.D{{Key: "roomId", Value: 1}, {Key: "status", Value: 1}, {Key: "_id", Value: -1}}, options.Index().SetName("idx_room_members_room_roster")},
			{bson.D{{Key: "roomId", Value: 1}, {Key: "xp", Value: -1}}, options.Index().SetName("idx_room_members_room_xp")},
		},
		// expiresAt TTL makes "offline" automatic: no cron job, and a crashed
		// client cannot stay online. expireAfterSeconds:0 expires at the stored time.
		"room_presence": {
			{bson.D{{Key: "roomId", Value: 1}, {Key: "userId", Value: 1}}, options.Index().SetName("uq_room_presence_room_user").SetUnique(true)},
			{bson.D{{Key: "roomId", Value: 1}, {Key: "expiresAt", Value: -1}}, options.Index().SetName("idx_room_presence_room_expires")},
			{bson.D{{Key: "expiresAt", Value: 1}}, options.Index().SetName("ttl_room_presence").SetExpireAfterSeconds(0)},
		},
		"room_sessions": {
			{bson.D{{Key: "roomId", Value: 1}, {Key: "endsAt", Value: -1}}, options.Index().SetName("idx_room_sessions_room_endsAt")},
			{bson.D{{Key: "roomId", Value: 1}, {Key: "startsAt", Value: -1}}, options.Index().SetName("idx_room_sessions_room_startsAt")},
			{bson.D{{Key: "hostId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_room_sessions_host")},
		},
		// The (sessionId,userId) uniqueness is what makes the XP award idempotent.
		// (roomId,completedAt) serves the leaderboard aggregation's $match.
		"room_session_participants": {
			{bson.D{{Key: "sessionId", Value: 1}, {Key: "userId", Value: 1}}, options.Index().SetName("uq_room_participants_session_user").SetUnique(true)},
			{bson.D{{Key: "roomId", Value: 1}, {Key: "completedAt", Value: -1}}, options.Index().SetName("idx_room_participants_room_completed")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "completedAt", Value: -1}}, options.Index().SetName("idx_room_participants_user_completed")},
		},
		"room_messages": {
			{bson.D{{Key: "roomId", Value: 1}, {Key: "_id", Value: -1}}, options.Index().SetName("idx_room_messages_room_id")},
			{bson.D{{Key: "roomId", Value: 1}, {Key: "userId", Value: 1}, {Key: "_id", Value: -1}}, options.Index().SetName("idx_room_messages_room_user")},
			{bson.D{{Key: "roomId", Value: 1}, {Key: "pinned", Value: -1}, {Key: "_id", Value: -1}}, options.Index().SetName("idx_room_messages_room_pinned").SetPartialFilterExpression(bson.M{"pinned": true})},
		},
		// Resource Vault endpoints are deferred; the text index ships now so
		// search can be added later without an index build on a populated collection.
		"room_resources": {
			{bson.D{{Key: "roomId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_room_resources_room_created")},
			{bson.D{{Key: "title", Value: "text"}, {Key: "description", Value: "text"}}, options.Index().SetName("txt_room_resources_search")},
		},
	}
}
