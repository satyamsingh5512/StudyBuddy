package handlers

import (
	"context"
	"errors"
	"log"
	"time"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"
	"studybuddy-backend/internal/security"
	"studybuddy-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	deletionOtpTTL          = 10 * time.Minute
	maxDeletionCodeAttempts = 5
)

var invalidDeletionCodeResponse = fiber.Map{
	"error":   "Invalid or expired code",
	"message": "Invalid or expired code",
}

// wipeTarget is one owner-scoped collection sweep of permanent account deletion.
type wipeTarget struct {
	collection string
	filter     bson.M
}

// deletionWipePlan lists every collection holding the account's data so the
// wipe is auditable and unit-testable. All filters are owner-scoped; shared
// collections (notices, faqs) are never touched.
func deletionWipePlan(userID primitive.ObjectID, email string) []wipeTarget {
	owned := bson.M{"userId": userID}
	eitherSide := bson.M{"$or": []bson.M{{"senderId": userID}, {"receiverId": userID}}}
	blockSide := bson.M{"$or": []bson.M{{"blockerId": userID}, {"blockedId": userID}}}
	plan := []wipeTarget{
		{collection: "todos", filter: owned},
		{collection: "notes", filter: owned},
		{collection: "timer_sessions", filter: owned},
		{collection: "goals", filter: owned},
		{collection: "goal_completions", filter: owned},
		{collection: "show_ups", filter: owned},
		{collection: "goal_check_ins", filter: owned},
		{collection: "journal_entries", filter: owned},
		{collection: "journal_attachments", filter: owned},
		{collection: "schedules", filter: owned},
		{collection: "availabilities", filter: owned},
		{collection: "daily_reports", filter: owned},
		{collection: "focus_sessions", filter: owned},
		{collection: "direct_messages", filter: eitherSide},
		{collection: "friend_requests", filter: eitherSide},
		{collection: "blocks", filter: blockSide},
		// Study Rooms. Membership, presence, accountability records, authored
		// chat and contributed resources are the account's own data and must go
		// with it, or "all associated data have been permanently deleted" is a
		// false claim. Shared room documents (study_rooms, room_sessions) are not
		// deleted here: they belong to the room's other members. Rooms the
		// account owned are archived separately by archiveOwnedRooms.
		{collection: "room_members", filter: owned},
		{collection: "room_presence", filter: owned},
		{collection: "room_session_participants", filter: owned},
		{collection: "room_messages", filter: owned},
		{collection: "room_resources", filter: bson.M{"addedBy": userID}},
	}
	if email != "" {
		plan = append(plan, wipeTarget{collection: "waitlist", filter: bson.M{"email": email}})
	}
	return plan
}

func executeDeletionWipe(ctx context.Context, db *mongo.Database, plan []wipeTarget) error {
	var errs []error
	for _, target := range plan {
		if _, err := db.Collection(target.collection).DeleteMany(ctx, target.filter); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

// releaseRoomMemberships decrements the denormalized memberCount for every room
// the account belonged to, and archives the rooms it owned. It must run BEFORE
// the wipe removes the room_members documents, otherwise the counts are lost and
// every room the user was in would over-report its size forever.
//
// Owned rooms are archived rather than deleted: other members' contributions,
// sessions and chat live there, so deleting the room would destroy their data
// along with the owner's.
func releaseRoomMemberships(ctx context.Context, db *mongo.Database, userID primitive.ObjectID) error {
	cursor, err := db.Collection("room_members").Find(ctx, bson.M{"userId": userID})
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)
	var memberships []models.RoomMember
	if err := cursor.All(ctx, &memberships); err != nil {
		return err
	}

	var errs []error
	for _, membership := range memberships {
		if membership.Status != models.RoomMemberActive {
			continue
		}
		if _, err := db.Collection("study_rooms").UpdateOne(ctx,
			bson.M{"_id": membership.RoomID, "memberCount": bson.M{"$gt": 0}},
			bson.M{"$inc": bson.M{"memberCount": -1}}); err != nil {
			errs = append(errs, err)
		}
	}
	if _, err := db.Collection("study_rooms").UpdateMany(ctx,
		bson.M{"ownerId": userID, "archived": false},
		bson.M{"$set": bson.M{"archived": true, "updatedAt": time.Now().UTC()}}); err != nil {
		errs = append(errs, err)
	}
	return errors.Join(errs...)
}

// RequestAccountDeletion emails a one-time code to the signed-in account so
// deletion requires access to the mailbox, not just the session.
func RequestAccountDeletion(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	if !requireDB(c) {
		return nil
	}

	otp, otpHash, err := security.NewOneTimeCode()
	if err != nil {
		return serverError(c)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := config.DB.Collection("users").UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": bson.M{
		"deletionOtp":       otpHash,
		"deletionOtpExpiry": time.Now().Add(deletionOtpTTL),
		"deletionAttempts":  0,
	}})
	if err != nil {
		return serverError(c)
	}
	if result.MatchedCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Account not found"})
	}

	if err := services.SendAccountDeletionEmail(user.Email, user.Name, otp); err != nil {
		log.Printf("account deletion email failed: %v", err)
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "Could not send the verification code",
			"message": "Could not send the verification code. Check your email configuration and try again.",
		})
	}
	return c.JSON(fiber.Map{"message": "A verification code has been sent to your email. It expires in 10 minutes."})
}

type ConfirmAccountDeletionRequest struct {
	OTP string `json:"otp"`
}

// ConfirmAccountDeletion verifies the emailed code, wipes every owner-scoped
// record, removes the user document, and clears the session cookie. Deletes
// are idempotent, so a retry after a partial failure converges.
func ConfirmAccountDeletion(c *fiber.Ctx) error {
	var req ConfirmAccountDeletionRequest
	if err := c.BodyParser(&req); err != nil || len(req.OTP) != 6 {
		return c.Status(fiber.StatusBadRequest).JSON(invalidDeletionCodeResponse)
	}
	sessionUser := c.Locals("user").(models.User)
	if !requireDB(c) {
		return nil
	}

	users := config.DB.Collection("users")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var user models.User
	if err := users.FindOne(ctx, bson.M{"_id": sessionUser.ID}).Decode(&user); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Account not found"})
	}
	if user.DeletionAttempts >= maxDeletionCodeAttempts || time.Now().After(user.DeletionOtpExpiry) ||
		!security.VerifyOneTimeCode(user.DeletionOtp, req.OTP) {
		_, _ = users.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$inc": bson.M{"deletionAttempts": 1}})
		return c.Status(fiber.StatusBadRequest).JSON(invalidDeletionCodeResponse)
	}

	// Consume the code first so it cannot be replayed for a second delete.
	if _, err := users.UpdateOne(ctx, bson.M{"_id": user.ID, "deletionOtp": user.DeletionOtp}, bson.M{
		"$unset": bson.M{"deletionOtp": "", "deletionOtpExpiry": ""},
		"$set":   bson.M{"deletionAttempts": 0},
	}); err != nil {
		return serverError(c)
	}

	// Must precede the wipe: it reads room_members before they are deleted.
	if err := releaseRoomMemberships(ctx, config.DB, user.ID); err != nil {
		log.Printf("room membership release failed for user %s: %v", user.ID.Hex(), err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Account deletion did not complete",
			"message": "Account deletion did not complete. Please try again.",
		})
	}

	if err := executeDeletionWipe(ctx, config.DB, deletionWipePlan(user.ID, user.Email)); err != nil {
		log.Printf("account data wipe failed for user %s: %v", user.ID.Hex(), err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Account deletion did not complete",
			"message": "Account deletion did not complete. Please try again.",
		})
	}
	if _, err := users.DeleteOne(ctx, bson.M{"_id": user.ID}); err != nil {
		log.Printf("account document delete failed for user %s: %v", user.ID.Hex(), err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Account deletion did not complete",
			"message": "Account deletion did not complete. Please try again.",
		})
	}

	clearSessionCookie(c)
	return c.JSON(fiber.Map{"success": true, "message": "Your account and all associated data have been permanently deleted."})
}
