package routes

import (
	"context"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/handlers"
	"studybuddy-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	healthReady := func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if config.DB == nil || config.DB.RunCommand(ctx, bson.D{{Key: "ping", Value: 1}}).Err() != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"status": "unavailable"})
		}
		return c.JSON(fiber.Map{"status": "ok"})
	}
	api.Get("/health", healthReady)
	api.Get("/health/live", func(c *fiber.Ctx) error { return c.JSON(fiber.Map{"status": "ok"}) })
	api.Get("/health/ready", healthReady)

	// Auth routes use both per-IP throttling here and account-scoped counters in handlers.
	auth := api.Group("/auth")
	auth.Post("/login", middleware.RateLimit(10, 15*time.Minute), handlers.Login)
	auth.Post("/signup", middleware.RateLimit(5, time.Hour), handlers.Signup)
	auth.Post("/verify-otp", middleware.RateLimit(10, 10*time.Minute), handlers.VerifyOTP)
	auth.Post("/resend-otp", middleware.RateLimit(3, 10*time.Minute), handlers.ResendOTP)
	auth.Post("/forgot-password", middleware.RateLimit(5, time.Hour), handlers.ForgotPassword)
	auth.Post("/reset-password", middleware.RateLimit(10, 15*time.Minute), handlers.ResetPassword)
	auth.Get("/google", middleware.RateLimit(20, 15*time.Minute), handlers.GoogleAuth)
	auth.Get("/google/callback", middleware.RateLimit(20, 15*time.Minute), handlers.GoogleCallback)

	// Public routes
	api.Get("/notices", handlers.GetNotices)
	api.Get("/faqs", handlers.GetFAQs)
	api.Get("/faqs/:examType", handlers.GetFAQs)
	api.Post("/waitlist", middleware.RateLimit(5, time.Hour), handlers.JoinWaitlist)
	// Public so the signup form can check availability before an account exists.
	// Rate limited per IP because it is otherwise a username enumeration oracle;
	// the ceiling stays well above debounced typing during a real signup.
	api.Get("/username/check/:username", middleware.RateLimit(60, time.Minute), handlers.CheckUsername)

	users := api.Group("/users")
	users.Get("/leaderboard", handlers.GetLeaderboard)

	// Protected routes
	protected := api.Group("", middleware.RequireAuth)

	// Protected Auth
	protected.Get("/auth/me", handlers.Me)
	protected.Post("/auth/logout", handlers.Logout)

	// Avatar
	protected.Post("/upload/avatar", handlers.UploadAvatar)
	protected.Delete("/upload/avatar", handlers.DeleteAvatar)

	// News
	protected.Get("/news/:examType", middleware.RateLimit(20, time.Hour), handlers.GetNews)
	protected.Get("/news/:examType/dates", middleware.RateLimit(20, time.Hour), handlers.GetNewsDates)
	protected.Post("/news/:examType/search", middleware.RateLimit(10, time.Hour), handlers.SearchNews)
	protected.Post("/news/cache/clear", middleware.RequireAdmin, handlers.ClearNewsCache)

	// Messages
	messages := protected.Group("/messages")
	messages.Post("/", middleware.RateLimit(60, time.Minute), handlers.SendMessage)
	messages.Get("/conversations", handlers.GetConversations)
	messages.Get("/:userId", handlers.GetMessages)

	// Users
	protected.Post("/users/onboarding", handlers.CompleteOnboarding)
	protected.Post("/username/check", handlers.CheckUsername)
	protected.Get("/users/profile", handlers.Me)
	protected.Put("/users/profile", handlers.UpdateProfile)
	protected.Patch("/users/profile", handlers.UpdateProfile) // Support PATCH for frontend compatibility

	// Admin
	admin := protected.Group("/admin")
	admin.Get("/stats", handlers.GetAdminStats)
	admin.Post("/send-daily-stats", handlers.SendDailyStats)

	// Todos
	todos := protected.Group("/todos")
	todos.Get("/", handlers.GetTodos)
	todos.Post("/", handlers.CreateTodo)
	todos.Delete("/by-day", handlers.DeleteTodosByDay)
	todos.Put("/:id", handlers.UpdateTodo)
	todos.Patch("/:id", handlers.UpdateTodo) // Support PATCH for frontend compatibility
	todos.Delete("/:id", handlers.DeleteTodo)
	todos.Post("/reschedule-all-overdue", handlers.RescheduleAllOverdue)
	todos.Patch("/:id/reschedule", handlers.RescheduleTodo)
	todos.Post("/:id/reschedule-to-today", handlers.RescheduleToToday)

	// Goals and show-up tracking
	goals := protected.Group("/goals")
	goals.Get("/", handlers.GetGoals)
	goals.Post("/", handlers.CreateGoal)
	// Keep collection-level batch paths before all /:id routes.
	goals.Post("/show-ups/batch", handlers.PutShowUpsBatch)
	goals.Get("/:id", handlers.GetGoal)
	goals.Patch("/:id", handlers.PatchGoal)
	goals.Delete("/:id", handlers.DeleteGoal)
	goals.Post("/:id/complete", handlers.CompleteGoal)
	goals.Post("/:id/archive", handlers.ArchiveGoal)
	goals.Post("/:id/restore", handlers.RestoreGoal)
	goals.Post("/:id/sub-goals", handlers.AddSubGoal)
	goals.Patch("/:id/sub-goals/reorder", handlers.ReorderSubGoals)
	goals.Patch("/:id/sub-goals/:subGoalId", handlers.UpdateSubGoal)
	goals.Delete("/:id/sub-goals/:subGoalId", handlers.DeleteSubGoal)
	goals.Post("/:id/milestones", handlers.AddMilestone)
	goals.Patch("/:id/milestones/reorder", handlers.ReorderMilestones)
	goals.Patch("/:id/milestones/:milestoneId", handlers.UpdateMilestone)
	goals.Delete("/:id/milestones/:milestoneId", handlers.DeleteMilestone)
	goals.Get("/:id/completions", handlers.GetGoalCompletions)
	goals.Put("/:id/sub-goals/:subGoalId/completions/:date", handlers.PutGoalCompletion)
	goals.Delete("/:id/sub-goals/:subGoalId/completions/:date", handlers.DeleteGoalCompletion)
	goals.Get("/:id/show-ups", handlers.GetShowUps)
	goals.Put("/:id/show-ups/:date", handlers.PutShowUp)
	goals.Delete("/:id/show-ups/:date", handlers.DeleteShowUp)
	goals.Get("/:id/check-ins", handlers.GetGoalCheckIns)
	goals.Put("/:id/check-ins/:weekStart", handlers.PutGoalCheckIn)
	goals.Get("/:id/stats", handlers.GetGoalStats)

	// Timer
	timer := protected.Group("/timer")
	timer.Post("/session", handlers.SaveTimerSession)
	timer.Get("/analytics", handlers.GetTimerAnalytics)

	// Friends
	friends := protected.Group("/friends")
	friends.Post("/request", handlers.SendFriendRequest)
	friends.Get("/requests", handlers.GetFriendRequests)
	friends.Get("/list", handlers.GetFriends)
	friends.Get("/search", handlers.SearchUsers)
	friends.Post("/request/:id/accept", handlers.AcceptFriendRequest)
	friends.Put("/request/:id/accept", handlers.AcceptFriendRequest)
	friends.Post("/request/:id/reject", handlers.RejectFriendRequest)
	friends.Put("/request/:id/reject", handlers.RejectFriendRequest)
	friends.Delete("/:id", handlers.DeleteFriend)
	friends.Post("/block", handlers.BlockUser)
	friends.Get("/blocked", handlers.GetBlockedUsers)
	friends.Delete("/block/:id", handlers.UnblockUser)

	// Reports
	reports := protected.Group("/reports")
	reports.Get("/", handlers.GetReports)
	reports.Get("/efficiency", handlers.GetDailyEfficiency)
	reports.Post("/", handlers.CreateReport)

	// Notes (notepad)
	notes := protected.Group("/notes")
	notes.Get("/", handlers.GetNotes)
	notes.Post("/", handlers.CreateNote)
	notes.Put("/:id", handlers.UpdateNote)
	notes.Patch("/:id", handlers.UpdateNote) // Support PATCH for frontend compatibility
	notes.Delete("/:id", handlers.DeleteNote)

	// Journal (separate from the legacy notepad /notes domain)
	journal := protected.Group("/journal")
	journal.Get("/", handlers.GetJournalRange)
	journal.Post("/attachments", handlers.UploadJournalAttachment)
	journal.Get("/attachments/:id", handlers.GetJournalAttachment)
	journal.Delete("/attachments/:id", handlers.DeleteJournalAttachment)
	journal.Get("/:date", handlers.GetJournalEntry)
	journal.Put("/:date", handlers.PutJournalEntry)
	journal.Delete("/:date", handlers.DeleteJournalEntry)

	// Read-only contextual AI mentor and derived achievements
	protected.Post("/mentor/respond", middleware.RateLimit(20, time.Hour), handlers.MentorRespond)
	protected.Get("/achievements", handlers.GetAchievements)

	// Schedule (AI-powered smart schedule)
	schedule := protected.Group("/schedule")
	schedule.Get("/", handlers.GetSchedules)
	schedule.Delete("/:id", handlers.DeleteSchedule)
	schedule.Patch("/:id/items/:itemId", handlers.UpdateScheduleItem)
	schedule.Post("/generate", middleware.RateLimit(5, time.Hour), handlers.GenerateSchedule)

	// Availability (user's weekly free/blocked time)
	availability := protected.Group("/availability")
	availability.Get("/", handlers.GetAvailability)
	availability.Post("/", handlers.UpsertAvailability)
	availability.Put("/", handlers.UpsertAvailability)
}
