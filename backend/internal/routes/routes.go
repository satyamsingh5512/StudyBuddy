package routes

import (
	"studybuddy-backend/internal/handlers"
	"studybuddy-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "message": "StudyBuddy Go API is running"})
	})

	// Auth routes
	auth := api.Group("/auth")
	auth.Post("/login", handlers.Login)
	auth.Post("/signup", handlers.Signup)
	auth.Post("/verify-otp", handlers.VerifyOTP)
	auth.Post("/resend-otp", handlers.ResendOTP)
	auth.Post("/logout", handlers.Logout)
	auth.Post("/forgot-password", handlers.ForgotPassword)
	auth.Post("/reset-password", handlers.ResetPassword)
	auth.Get("/google", handlers.GoogleAuth)
	auth.Get("/google/callback", handlers.GoogleCallback)

	// Public routes
	api.Get("/notices", handlers.GetNotices)
	api.Get("/faqs", handlers.GetFAQs)
	api.Get("/faqs/:examType", handlers.GetFAQs)
	api.Post("/waitlist", handlers.JoinWaitlist)
	api.Get("/username/check/:username", handlers.CheckUsername)

	users := api.Group("/users")
	users.Get("/leaderboard", handlers.GetLeaderboard)

	// Protected routes
	protected := api.Group("", middleware.RequireAuth)

	// Protected Auth
	protected.Get("/auth/me", handlers.Me)

	// Avatar
	protected.Post("/upload/avatar", handlers.UploadAvatar)
	protected.Delete("/upload/avatar", handlers.DeleteAvatar)

	// News
	protected.Get("/news/:examType", handlers.GetNews)
	protected.Get("/news/:examType/dates", handlers.GetNewsDates)
	protected.Post("/news/cache/clear", handlers.ClearNewsCache)

	// Messages
	messages := protected.Group("/messages")
	messages.Post("/", handlers.SendMessage)
	messages.Get("/conversations", handlers.GetConversations)
	messages.Get("/:userId", handlers.GetMessages)

	// Users
	protected.Post("/users/onboarding", handlers.CompleteOnboarding)
	protected.Post("/username/check", handlers.CheckUsername)
	protected.Get("/username/check/:username", handlers.CheckUsername)
	protected.Get("/users/profile", handlers.Me)
	protected.Put("/users/profile", handlers.UpdateProfile)

	// Admin
	admin := protected.Group("/admin")
	admin.Get("/stats", handlers.GetAdminStats)
	admin.Post("/send-daily-stats", handlers.SendDailyStats)

	// Todos
	todos := protected.Group("/todos")
	todos.Get("/", handlers.GetTodos)
	todos.Post("/", handlers.CreateTodo)
	todos.Put("/:id", handlers.UpdateTodo)
	todos.Delete("/:id", handlers.DeleteTodo)
	todos.Post("/reschedule-all-overdue", handlers.RescheduleAllOverdue)
	todos.Patch("/:id/reschedule", handlers.RescheduleTodo)
	todos.Post("/:id/reschedule-to-today", handlers.RescheduleToToday)

	// Timer
	timer := protected.Group("/timer")
	timer.Post("/session", handlers.SaveTimerSession)
	timer.Get("/analytics", handlers.GetTimerAnalytics)

	// Schedule
	schedule := protected.Group("/schedule")
	schedule.Get("/", handlers.GetSchedule)
	schedule.Post("/", handlers.CreateSchedule)
	schedule.Put("/:id", handlers.UpdateSchedule)
	schedule.Delete("/:id", handlers.DeleteSchedule)

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
	reports.Post("/", handlers.CreateReport)
}
