package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestPutJournalRevisionConflictReturnsAuthoritativeCurrentEntry(t *testing.T) {
	oldFactory := journalMutationStoreFactory
	defer func() { journalMutationStoreFactory = oldFactory }()
	store := newMutableJournalStore()
	store.entry = &models.JournalEntry{ID: primitive.NewObjectID(), UserID: store.owner, Date: "2026-08-07", Markdown: "authoritative", Revision: 7, AttachmentIDs: []primitive.ObjectID{}}
	journalMutationStoreFactory = func() journalMutationStore { return store }

	app := fiber.New()
	app.Put("/journal/:date", func(c *fiber.Ctx) error {
		c.Locals("user", models.User{ID: store.owner, Timezone: "UTC"})
		return c.Next()
	}, PutJournalEntry)
	request := httptest.NewRequest("PUT", "/journal/2026-08-07", strings.NewReader(`{"markdown":"stale","expectedRevision":6}`))
	request.Header.Set("Content-Type", "application/json")
	response, err := app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var body struct {
		Current models.JournalEntry `json:"current"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusConflict || body.Current.Revision != 7 || body.Current.Markdown != "authoritative" {
		t.Fatalf("status=%d current=%#v", response.StatusCode, body.Current)
	}
}

func TestJournalAttachmentMIMEHeadersAndQuotaContract(t *testing.T) {
	if !allowedJournalImageMIME("image/jpeg") || !allowedJournalImageMIME("image/png") || !allowedJournalImageMIME("image/gif") || allowedJournalImageMIME("image/svg+xml") || allowedJournalImageMIME("text/html") {
		t.Fatal("journal MIME allowlist changed unsafely")
	}
	if maxJournalAttachments != 20 || maxJournalAttachmentQuota != maxJournalAttachments*maxJournalAttachmentBytes {
		t.Fatalf("quota=%d slots=%d per-file=%d", maxJournalAttachmentQuota, maxJournalAttachments, maxJournalAttachmentBytes)
	}
	app := fiber.New()
	app.Get("/attachment", func(c *fiber.Ctx) error {
		setJournalAttachmentResponseHeaders(c, "image/png")
		return c.Send([]byte("png"))
	})
	response, err := app.Test(httptest.NewRequest("GET", "/attachment", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.Header.Get("Content-Type") != "image/png" || response.Header.Get("Cache-Control") != "private, no-store" || response.Header.Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("headers=%v", response.Header)
	}
}
