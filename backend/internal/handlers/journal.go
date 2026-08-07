package handlers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"studybuddy-backend/internal/config"
	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	journalEntriesCollection     = "journal_entries"
	journalAttachmentsCollection = "journal_attachments"
	maxJournalMarkdownBytes      = 64 * 1024
	maxJournalRangeDays          = 366
	maxJournalAttachmentBytes    = 1 * 1024 * 1024
	maxJournalAttachmentQuota    = 20 * 1024 * 1024
	maxJournalAttachments        = maxJournalAttachmentQuota / maxJournalAttachmentBytes
	maxAttachmentsPerEntry       = 10
)

var journalAttachmentReference = regexp.MustCompile(`(?:/api)?/journal/attachments/([0-9a-fA-F]{24})`)

func journalRevisionFilter(userID primitive.ObjectID, date string, revision int64) bson.M {
	return bson.M{"userId": userID, "date": date, "revision": revision}
}

func allowedJournalImageMIME(mime string) bool {
	return mime == "image/jpeg" || mime == "image/png" || mime == "image/gif"
}

func journalDate(c *fiber.Ctx, user models.User, raw string) (string, error) {
	location := goalRequestLocation(c, user)
	date, err := parseDateOnlyInLocation(raw, location)
	if err != nil {
		return "", fmt.Errorf("date must use YYYY-MM-DD")
	}
	return date.Format(goalDateLayout), nil
}

func attachmentIDsInMarkdown(markdown string) ([]primitive.ObjectID, error) {
	matches := journalAttachmentReference.FindAllStringSubmatch(markdown, -1)
	seen := make(map[primitive.ObjectID]struct{}, len(matches))
	ids := make([]primitive.ObjectID, 0, len(matches))
	for _, match := range matches {
		id, err := primitive.ObjectIDFromHex(match[1])
		if err != nil {
			continue
		}
		if _, duplicate := seen[id]; duplicate {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) > maxAttachmentsPerEntry {
		return nil, fmt.Errorf("journal entry cannot reference more than %d attachments", maxAttachmentsPerEntry)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i].Hex() < ids[j].Hex() })
	return ids, nil
}

func validateJournalMarkdown(markdown string) error {
	if !utf8.ValidString(markdown) {
		return errors.New("markdown must be valid UTF-8")
	}
	if len(markdown) > maxJournalMarkdownBytes {
		return fmt.Errorf("markdown cannot exceed %d bytes", maxJournalMarkdownBytes)
	}
	return nil
}

func GetJournalRange(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	location := goalRequestLocation(c, user)
	from, to := c.Query("from"), c.Query("to")
	start, end, err := parseGoalRangeInLocation(from, to, location)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if end.After(start.AddDate(0, 0, maxJournalRangeDays-1)) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "date range is too large"})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cursor, err := config.DB.Collection(journalEntriesCollection).Find(ctx, bson.M{
		"userId": user.ID, "date": bson.M{"$gte": from, "$lte": to}, "mutationToken": bson.M{"$exists": false},
	}, options.Find().SetSort(bson.D{{Key: "date", Value: 1}}).SetLimit(maxJournalRangeDays))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch journal"})
	}
	defer cursor.Close(ctx)
	entries := []models.JournalEntry{}
	if err := cursor.All(ctx, &entries); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse journal"})
	}
	return c.JSON(entries)
}

func GetJournalEntry(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	date, err := journalDate(c, user, c.Params("date"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var entry models.JournalEntry
	err = config.DB.Collection(journalEntriesCollection).FindOne(ctx, bson.M{"userId": user.ID, "date": date, "mutationToken": bson.M{"$exists": false}}).Decode(&entry)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return c.JSON(models.JournalEntry{Date: date, Markdown: "", Revision: 0, AttachmentIDs: []primitive.ObjectID{}})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch journal entry"})
	}
	if entry.AttachmentIDs == nil {
		entry.AttachmentIDs = []primitive.ObjectID{}
	}
	return c.JSON(entry)
}

func PutJournalEntry(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	date, err := journalDate(c, user, c.Params("date"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	var req struct {
		Markdown         string `json:"markdown"`
		ExpectedRevision *int64 `json:"expectedRevision"`
	}
	if c.BodyParser(&req) != nil || req.ExpectedRevision == nil || *req.ExpectedRevision < 0 {
		return c.Status(400).JSON(fiber.Map{"error": "expectedRevision must be a non-negative integer"})
	}
	if err := validateJournalMarkdown(req.Markdown); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	attachmentIDs, err := attachmentIDsInMarkdown(req.Markdown)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	entry, err := putJournalEntryFenced(ctx, currentJournalMutationStore(), user.ID, date, req.Markdown, attachmentIDs, *req.ExpectedRevision, time.Now().UTC())
	if err == nil {
		if entry.AttachmentIDs == nil {
			entry.AttachmentIDs = []primitive.ObjectID{}
		}
		return c.JSON(entry)
	}
	if errors.Is(err, errJournalAttachmentUnavailable) || errors.Is(err, errJournalAttachmentBusy) {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "journal references an unavailable attachment"})
	}
	if !errors.Is(err, errJournalRevisionConflict) {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save journal entry"})
	}
	current, currentErr := currentJournalMutationStore().FindJournalEntry(ctx, user.ID, date)
	if errors.Is(currentErr, mongo.ErrNoDocuments) {
		current = models.JournalEntry{Date: date, Markdown: "", Revision: 0, AttachmentIDs: []primitive.ObjectID{}}
	} else if currentErr != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to resolve journal conflict"})
	}
	if current.AttachmentIDs == nil {
		current.AttachmentIDs = []primitive.ObjectID{}
	}
	return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Journal entry changed; refresh and try again", "current": current})
}

func DeleteJournalEntry(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	date, err := journalDate(c, user, c.Params("date"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	filter := bson.M{"userId": user.ID, "date": date}
	if raw := strings.TrimSpace(c.Query("expectedRevision")); raw != "" {
		revision, parseErr := strconv.ParseInt(raw, 10, 64)
		if parseErr != nil || revision < 0 {
			return c.Status(400).JSON(fiber.Map{"error": "expectedRevision must be a non-negative integer"})
		}
		filter["revision"] = revision
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	result, err := config.DB.Collection(journalEntriesCollection).DeleteOne(ctx, filter)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete journal entry"})
	}
	if result.DeletedCount == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Journal entry not found"})
	}
	return c.SendStatus(204)
}

func UploadJournalAttachment(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	file, err := c.FormFile("file")
	if err != nil || file.Size <= 0 || file.Size > maxJournalAttachmentBytes {
		return c.Status(400).JSON(fiber.Map{"error": "file must be an image no larger than 1 MiB"})
	}
	opened, err := file.Open()
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid file"})
	}
	defer opened.Close()
	data, err := io.ReadAll(io.LimitReader(opened, maxJournalAttachmentBytes+1))
	if err != nil || len(data) == 0 || len(data) > maxJournalAttachmentBytes {
		return c.Status(400).JSON(fiber.Map{"error": "file must be an image no larger than 1 MiB"})
	}
	mime := http.DetectContentType(data)
	if !allowedJournalImageMIME(mime) {
		return c.Status(400).JSON(fiber.Map{"error": "only JPEG, PNG, and GIF images are allowed"})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	now := time.Now().UTC()
	for slot := 0; slot < maxJournalAttachments; slot++ {
		attachment := models.JournalAttachment{ID: primitive.NewObjectID(), UserID: user.ID, MIME: mime, Size: int64(len(data)), Slot: slot, Data: data, CreatedAt: now}
		if _, err := config.DB.Collection(journalAttachmentsCollection).InsertOne(ctx, attachment); err == nil {
			return c.Status(201).JSON(fiber.Map{"id": attachment.ID, "mime": attachment.MIME, "size": attachment.Size, "url": "/api/journal/attachments/" + attachment.ID.Hex()})
		} else if !mongo.IsDuplicateKeyError(err) {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save attachment"})
		}
	}
	return c.Status(413).JSON(fiber.Map{"error": "Journal attachment quota exceeded"})
}

func setJournalAttachmentResponseHeaders(c *fiber.Ctx, mime string) {
	c.Set(fiber.HeaderContentType, mime)
	c.Set(fiber.HeaderCacheControl, "private, no-store")
	c.Set("X-Content-Type-Options", "nosniff")
}

func GetJournalAttachment(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid attachment ID"})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var attachment models.JournalAttachment
	err = config.DB.Collection(journalAttachmentsCollection).FindOne(ctx, bson.M{"_id": id, "userId": user.ID, "deletionState": bson.M{"$exists": false}}).Decode(&attachment)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return c.Status(404).JSON(fiber.Map{"error": "Attachment not found"})
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch attachment"})
	}
	setJournalAttachmentResponseHeaders(c, attachment.MIME)
	return c.Send(attachment.Data)
}

func DeleteJournalAttachment(c *fiber.Ctx) error {
	user := c.Locals("user").(models.User)
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid attachment ID"})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	err = deleteJournalAttachmentFenced(ctx, currentJournalMutationStore(), user.ID, id, time.Now().UTC())
	if err == nil || errors.Is(err, mongo.ErrNoDocuments) {
		// A missing owner-scoped object is already in the requested state. This
		// also avoids leaking whether another owner has the supplied ID.
		return c.SendStatus(204)
	}
	if errors.Is(err, errJournalAttachmentReferenced) {
		return c.Status(409).JSON(fiber.Map{"error": "Attachment is referenced by a journal entry"})
	}
	if errors.Is(err, errJournalAttachmentBusy) {
		return c.Status(409).JSON(fiber.Map{"error": "Attachment is currently being referenced; retry deletion"})
	}
	return c.Status(500).JSON(fiber.Map{"error": "Failed to delete attachment"})
}
