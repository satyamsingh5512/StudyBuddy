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
		"todos": {
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("idx_todos_userId")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "dueDate", Value: -1}}, options.Index().SetName("idx_todos_userId_dueDate")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "scheduledDate", Value: -1}}, options.Index().SetName("idx_todos_userId_scheduledDate")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "completed", Value: 1}}, options.Index().SetName("idx_todos_userId_completed")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "scheduledDate", Value: -1}, {Key: "completed", Value: 1}}, options.Index().SetName("idx_todos_userId_scheduled_completed")},
		},
		"timer_sessions": {
			{bson.D{{Key: "userId", Value: 1}}, options.Index().SetName("idx_timer_userId")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "startTime", Value: -1}}, options.Index().SetName("idx_timer_userId_startTime")},
			{bson.D{{Key: "userId", Value: 1}, {Key: "createdAt", Value: -1}}, options.Index().SetName("idx_timer_userId_createdAt")},
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
	}
}
