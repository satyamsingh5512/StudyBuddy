package handlers

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"studybuddy-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestRegexQuoteMetaNeutralizesUserSuppliedPatterns(t *testing.T) {
	// Discovery search interpolates the query into a Mongo $regex. Every
	// metacharacter must be escaped or a user could run an unanchored scan or a
	// catastrophic backtracking pattern against study_rooms.
	cases := map[string]string{
		".*":         `\.\*`,
		"a+b":        `a\+b`,
		"(a|b)":      `\(a\|b\)`,
		"[a-z]":      `\[a-z\]`,
		"a{1,9}":     `a\{1,9\}`,
		"^start$":    `\^start\$`,
		`back\slash`: `back\\slash`,
		"GATE 2027":  "GATE 2027",
		"(a+)+$":     `\(a\+\)\+\$`,
	}
	for input, want := range cases {
		if got := regexQuoteMeta(input); got != want {
			t.Errorf("regexQuoteMeta(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestParseRoomLimitClampsToSafeRange(t *testing.T) {
	tests := []struct {
		raw  string
		want int64
	}{
		{"", defaultRoomLimit},
		{"abc", defaultRoomLimit},
		{"0", defaultRoomLimit},
		{"-5", defaultRoomLimit},
		{"10", 10},
		{"50", maxRoomLimit},
		{"5000", maxRoomLimit},
		{"99999999999999999999", defaultRoomLimit},
	}
	for _, test := range tests {
		if got := parseRoomLimit(test.raw); got != test.want {
			t.Errorf("parseRoomLimit(%q) = %d, want %d", test.raw, got, test.want)
		}
	}
}

func TestSummarizeUserOmitsPrivateFields(t *testing.T) {
	user := models.User{
		ID: primitive.NewObjectID(), Name: "Aditi", Username: "aditi",
		Email: "aditi@example.com", Password: "hashed-secret",
		VerificationOtp: "123456", ResetToken: "reset-token",
	}
	summary := summarizeUser(user)
	if summary.Username != "aditi" || summary.Name != "Aditi" {
		t.Fatalf("summary = %#v", summary)
	}

	// userSummary is the only user shape rooms expose, so its field set is a
	// security boundary: assert it by reflection rather than trusting review.
	allowed := map[string]struct{}{
		"ID": {}, "Name": {}, "Username": {}, "Avatar": {}, "AvatarType": {},
	}
	summaryType := reflect.TypeOf(summary)
	for index := 0; index < summaryType.NumField(); index++ {
		field := summaryType.Field(index).Name
		if _, ok := allowed[field]; !ok {
			t.Errorf("userSummary gained field %q: room rosters must not expose account data", field)
		}
	}
	if summaryType.NumField() != len(allowed) {
		t.Errorf("userSummary has %d fields, want %d", summaryType.NumField(), len(allowed))
	}

	// Serialized output must not contain any private value.
	encoded, err := json.Marshal(summary)
	if err != nil {
		t.Fatal(err)
	}
	for _, secret := range []string{"aditi@example.com", "hashed-secret", "123456", "reset-token"} {
		if strings.Contains(string(encoded), secret) {
			t.Fatalf("serialized summary leaked %q: %s", secret, encoded)
		}
	}
}

func TestRoomContextMembershipPredicates(t *testing.T) {
	active := models.RoomMember{Status: models.RoomMemberActive, Role: models.RoomRoleMember}
	banned := models.RoomMember{Status: models.RoomMemberBanned, Role: models.RoomRoleMember}
	pending := models.RoomMember{Status: models.RoomMemberPending, Role: models.RoomRoleMember}

	if rc := (roomContext{Member: &active}); !rc.isMember() || rc.isBanned() {
		t.Fatal("active membership misclassified")
	}
	if rc := (roomContext{Member: &banned}); rc.isMember() || !rc.isBanned() {
		t.Fatal("banned membership misclassified")
	}
	// Pending is not yet a member: it must not grant read or write access.
	if rc := (roomContext{Member: &pending}); rc.isMember() {
		t.Fatal("pending membership granted access")
	}
	if rc := (roomContext{}); rc.isMember() || rc.isBanned() {
		t.Fatal("absent membership misclassified")
	}
}

func TestRoomResponseExposesViewerCapabilities(t *testing.T) {
	owner := models.User{ID: primitive.NewObjectID()}
	room := models.StudyRoom{
		ID: primitive.NewObjectID(), Name: "DSA Grind", OwnerID: owner.ID,
		Visibility: models.RoomVisibilityPublic, InviteCode: "super-secret-code",
	}
	ownerMember := models.RoomMember{Status: models.RoomMemberActive, Role: models.RoomRoleOwner}
	rc := roomContext{Room: room, Member: &ownerMember, Role: models.RoomRoleOwner}

	payload := roomResponse(room, &rc, owner)
	if payload["canAdminister"] != true || payload["canModerate"] != true || payload["isMember"] != true {
		t.Fatalf("owner capabilities = %#v", payload)
	}
	// The invite code is a credential: roomResponse must never include it, even
	// for the owner (GetRoom adds it deliberately after an explicit role check).
	if _, leaked := payload["inviteCode"]; leaked {
		t.Fatal("roomResponse leaked the invite code")
	}

	outsider := models.User{ID: primitive.NewObjectID(), Streak: 1}
	elite := models.StudyRoom{
		ID: room.ID, Visibility: models.RoomVisibilityElite,
		Requirements: &models.EntryRequirements{MinStreak: 30},
	}
	guestPayload := roomResponse(elite, &roomContext{Room: elite}, outsider)
	if guestPayload["isMember"] != false || guestPayload["canModerate"] != false {
		t.Fatalf("outsider capabilities = %#v", guestPayload)
	}
	if guestPayload["eligible"] != false {
		t.Fatal("ineligible outsider was reported as eligible")
	}
	reasons, ok := guestPayload["ineligibleReasons"].([]string)
	if !ok || len(reasons) == 0 {
		t.Fatalf("expected actionable reasons, got %#v", guestPayload["ineligibleReasons"])
	}

	// A non-elite room must not fabricate eligibility reasons.
	publicGuest := roomResponse(room, &roomContext{Room: room}, outsider)
	if publicGuest["eligible"] != true {
		t.Fatal("public room reported an outsider as ineligible")
	}
}

func TestRoomMessageResponseHidesDeletedBodies(t *testing.T) {
	author := primitive.NewObjectID()
	summaries := map[primitive.ObjectID]userSummary{author: {ID: author.Hex(), Username: "aditi"}}
	reactor := primitive.NewObjectID()

	live := models.RoomMessage{
		ID: primitive.NewObjectID(), UserID: author, Body: "hello room",
		Reactions: map[string][]primitive.ObjectID{"🔥": {reactor}, "👏": {}},
	}
	payload := roomMessageResponse(live, summaries)
	if payload["body"] != "hello room" {
		t.Fatalf("body = %v", payload["body"])
	}
	// An emoji with no reactors must be dropped rather than shipped as count 0.
	reactions, ok := payload["reactions"].([]fiber.Map)
	if !ok {
		t.Fatalf("reactions type = %T", payload["reactions"])
	}
	if len(reactions) != 1 || reactions[0]["emoji"] != "🔥" || reactions[0]["count"] != 1 {
		t.Fatalf("reactions = %#v", reactions)
	}

	deleted := models.RoomMessage{ID: primitive.NewObjectID(), UserID: author, Body: "should never ship", Deleted: true}
	deletedPayload := roomMessageResponse(deleted, summaries)
	if deletedPayload["body"] != "" {
		t.Fatalf("deleted message leaked its body: %v", deletedPayload["body"])
	}
	if deletedPayload["deleted"] != true {
		t.Fatal("deleted flag missing")
	}
}

func TestSessionResponseDerivesStatusAndNeverTrustsStoredStatus(t *testing.T) {
	now := time.Now().UTC()
	session := models.RoomSession{
		ID: primitive.NewObjectID(), RoomID: primitive.NewObjectID(), HostID: primitive.NewObjectID(),
		// Stored status is deliberately stale: the response must ignore it and
		// derive status from the clock, so a missed job cannot pin a session
		// "active" forever.
		Status:   models.SessionStatusActive,
		StartsAt: now.Add(-2 * time.Minute),
		EndsAt:   now.Add(-1 * time.Minute),
	}
	payload := sessionResponse(session, nil, nil, now)
	if payload["status"] != models.SessionStatusEnded {
		t.Fatalf("status = %v, want derived %q", payload["status"], models.SessionStatusEnded)
	}
	participants, ok := payload["participants"].([]fiber.Map)
	if !ok || participants == nil {
		t.Fatal("participants must be an empty list, not null, so clients can map over it")
	}
	if len(participants) != 0 {
		t.Fatalf("participants = %#v", participants)
	}
}
