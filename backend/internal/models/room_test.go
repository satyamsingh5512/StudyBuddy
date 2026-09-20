package models

import (
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func validRoomInput() RoomInput {
	return RoomInput{
		Name:        "GATE 2027 Grind",
		Description: "Daily problem solving",
		Category:    "competitive-exam",
		Tags:        []string{"GATE", "gate", " Maths "},
		Visibility:  RoomVisibilityPublic,
	}
}

func TestValidateRoomInputNormalizesAndAccepts(t *testing.T) {
	now := time.Now().UTC()
	clean, err := ValidateRoomInput(validRoomInput(), now)
	if err != nil {
		t.Fatalf("valid input rejected: %v", err)
	}
	// Tags must be de-duplicated case-insensitively, whitespace-joined and sorted
	// so the tag index is effective and "GATE"/"gate" are one tag.
	if len(clean.Tags) != 2 || clean.Tags[0] != "gate" || clean.Tags[1] != "maths" {
		t.Fatalf("tags = %#v, want [gate maths]", clean.Tags)
	}
	if clean.Name != "GATE 2027 Grind" {
		t.Fatalf("name = %q", clean.Name)
	}
}

func TestValidateRoomInputRejectsInvalidPayloads(t *testing.T) {
	now := time.Now().UTC()
	future := now.Add(48 * time.Hour)
	past := now.Add(-48 * time.Hour)

	tests := []struct {
		name    string
		mutate  func(*RoomInput)
		wantErr error
	}{
		{"short name", func(in *RoomInput) { in.Name = "ab" }, ErrRoomNameLength},
		{"long name", func(in *RoomInput) { in.Name = strings.Repeat("a", RoomNameMaxRunes+1) }, ErrRoomNameLength},
		{"zero width only name", func(in *RoomInput) { in.Name = "\u200b\u200b\u200b\u200b" }, ErrRoomNameLength},
		{"script in name", func(in *RoomInput) { in.Name = "<script>alert(1)</script>" }, ErrRoomNameInvalid},
		{"long description", func(in *RoomInput) { in.Description = strings.Repeat("d", RoomDescriptionMaxRunes+1) }, ErrRoomDescriptionLong},
		{"bad visibility", func(in *RoomInput) { in.Visibility = "secret" }, ErrRoomVisibility},
		{"bad category", func(in *RoomInput) { in.Category = "anything-goes" }, ErrRoomCategory},
		{"too many tags", func(in *RoomInput) {
			in.Tags = []string{"a", "b", "c", "d", "e", "f", "g", "h", "i"}
		}, ErrRoomTags},
		{"http cover", func(in *RoomInput) { in.CoverImageURL = "http://example.com/a.png" }, ErrRoomCoverURL},
		{"javascript cover", func(in *RoomInput) { in.CoverImageURL = "javascript:alert(1)" }, ErrRoomCoverURL},
		{"goal room without goal", func(in *RoomInput) { in.Visibility = RoomVisibilityGoal }, ErrRoomGoalRequired},
		{"goal room past date", func(in *RoomInput) {
			in.Visibility = RoomVisibilityGoal
			in.Goal = &RoomGoal{Description: "Finish DBMS", TargetDate: &past}
		}, ErrRoomGoalDate},
		{"elite room without requirements", func(in *RoomInput) { in.Visibility = RoomVisibilityElite }, ErrRoomEliteRequired},
		{"elite room with empty requirements", func(in *RoomInput) {
			in.Visibility = RoomVisibilityElite
			in.Requirements = &EntryRequirements{}
		}, ErrRoomEliteRequired},
		{"elite room negative requirement", func(in *RoomInput) {
			in.Visibility = RoomVisibilityElite
			in.Requirements = &EntryRequirements{MinStreak: -1}
		}, ErrRoomEliteRange},
		{"elite room absurd requirement", func(in *RoomInput) {
			in.Visibility = RoomVisibilityElite
			in.Requirements = &EntryRequirements{MinStreak: 99999}
		}, ErrRoomEliteRange},
	}
	for _, test := range tests {
		input := validRoomInput()
		test.mutate(&input)
		_, err := ValidateRoomInput(input, now)
		if err == nil {
			t.Errorf("%s: accepted invalid input", test.name)
			continue
		}
		if test.wantErr != nil && err != test.wantErr {
			t.Errorf("%s: err = %v, want %v", test.name, err, test.wantErr)
		}
	}

	// A well-formed goal room must still pass.
	goalRoom := validRoomInput()
	goalRoom.Visibility = RoomVisibilityGoal
	goalRoom.Goal = &RoomGoal{Description: "Finish DBMS", TargetDate: &future, TargetHours: 40}
	if _, err := ValidateRoomInput(goalRoom, now); err != nil {
		t.Fatalf("valid goal room rejected: %v", err)
	}
}

func TestRoomNameAllowsInternationalCharacters(t *testing.T) {
	input := validRoomInput()
	input.Name = "गणित मास्टरी"
	if _, err := ValidateRoomInput(input, time.Now().UTC()); err != nil {
		t.Fatalf("international name rejected: %v", err)
	}
}

func TestSlugifyProducesURLSafeSlug(t *testing.T) {
	if slug := Slugify("  GATE 2027 -- Grind!! "); slug != "gate-2027-grind" {
		t.Fatalf("slug = %q", slug)
	}
	if slug := Slugify("***"); slug != "" {
		t.Fatalf("punctuation-only slug = %q, want empty", slug)
	}
}

func TestMeetsEntryRequirementsReportsEveryUnmetReason(t *testing.T) {
	requirements := &EntryRequirements{MinStudyMinutes: 600, MinPoints: 500, MinStreak: 7}
	weak := User{TotalStudyMins: 10, TotalPoints: 10, Streak: 1}
	ok, reasons := MeetsEntryRequirements(requirements, weak)
	if ok || len(reasons) != 3 {
		t.Fatalf("ok=%v reasons=%#v, want all three unmet", ok, reasons)
	}
	strong := User{TotalStudyMins: 600, TotalPoints: 500, Streak: 7}
	if ok, _ := MeetsEntryRequirements(requirements, strong); !ok {
		t.Fatal("exact threshold rejected; boundary must be inclusive")
	}
	if ok, _ := MeetsEntryRequirements(nil, weak); !ok {
		t.Fatal("nil requirements must admit everyone")
	}
}

func TestCanJoinRoomGating(t *testing.T) {
	user := User{TotalStudyMins: 100, TotalPoints: 100, Streak: 2}
	strong := User{TotalStudyMins: 10000, TotalPoints: 10000, Streak: 90}

	public := StudyRoom{Visibility: RoomVisibilityPublic}
	if ok, _ := CanJoinRoom(public, user, ""); !ok {
		t.Fatal("public room refused a normal user")
	}

	archived := StudyRoom{Visibility: RoomVisibilityPublic, Archived: true}
	if ok, _ := CanJoinRoom(archived, user, ""); ok {
		t.Fatal("archived room accepted a join")
	}

	full := StudyRoom{Visibility: RoomVisibilityPublic, MemberCount: RoomMemberCap}
	if ok, reason := CanJoinRoom(full, user, ""); ok || reason != ErrRoomFull.Error() {
		t.Fatalf("full room ok=%v reason=%q", ok, reason)
	}

	private := StudyRoom{Visibility: RoomVisibilityPrivate, InviteCode: "abc123"}
	if ok, _ := CanJoinRoom(private, user, ""); ok {
		t.Fatal("private room joined without an invite")
	}
	if ok, _ := CanJoinRoom(private, user, "wrong"); ok {
		t.Fatal("private room joined with a wrong invite")
	}
	if ok, _ := CanJoinRoom(private, user, "abc123"); !ok {
		t.Fatal("private room refused a correct invite")
	}
	// A private room with no code must never be joinable by guessing "".
	if ok, _ := CanJoinRoom(StudyRoom{Visibility: RoomVisibilityPrivate}, user, ""); ok {
		t.Fatal("private room without a code accepted an empty invite")
	}

	elite := StudyRoom{Visibility: RoomVisibilityElite, Requirements: &EntryRequirements{MinStreak: 30}}
	if ok, _ := CanJoinRoom(elite, user, ""); ok {
		t.Fatal("elite room admitted an ineligible user")
	}
	if ok, _ := CanJoinRoom(elite, strong, ""); !ok {
		t.Fatal("elite room refused an eligible user")
	}
}

func TestRolePermissionsAndEscalation(t *testing.T) {
	owner, moderator, member := RoomRoleOwner, RoomRoleModerator, RoomRoleMember
	if !CanModerate(owner) || !CanModerate(moderator) || CanModerate(member) || CanModerate("") {
		t.Fatal("CanModerate is wrong")
	}
	if !CanAdministerRoom(owner) || CanAdministerRoom(moderator) || CanAdministerRoom(member) {
		t.Fatal("CanAdministerRoom must be owner-only")
	}

	actor, target := primitive.NewObjectID(), primitive.NewObjectID()
	if CanAssignRole(moderator, actor, target, RoomRoleModerator) {
		t.Fatal("a moderator must not assign roles")
	}
	if CanAssignRole(owner, actor, actor, RoomRoleMember) {
		t.Fatal("nobody may change their own role")
	}
	if CanAssignRole(owner, actor, target, RoomRoleOwner) {
		t.Fatal("ownership must not be mintable through role assignment")
	}
	if !CanAssignRole(owner, actor, target, RoomRoleModerator) {
		t.Fatal("owner must be able to promote a moderator")
	}

	author, other := primitive.NewObjectID(), primitive.NewObjectID()
	if !CanDeleteMessage(author, author, member) {
		t.Fatal("authors must delete their own messages")
	}
	if CanDeleteMessage(other, author, member) {
		t.Fatal("a plain member deleted someone else's message")
	}
	if !CanDeleteMessage(other, author, moderator) {
		t.Fatal("moderators must delete any message")
	}
}

func TestSanitizeMessageBody(t *testing.T) {
	clean, err := SanitizeMessageBody("  hello\u200b   world \n")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clean != "hello world" {
		t.Fatalf("clean = %q, want %q", clean, "hello world")
	}
	if _, err := SanitizeMessageBody("   \n\t "); err != ErrMessageEmpty {
		t.Fatalf("whitespace-only err = %v", err)
	}
	if _, err := SanitizeMessageBody("\u200b\u200b"); err != ErrMessageEmpty {
		t.Fatalf("zero-width-only err = %v", err)
	}
	// The cap is counted in runes, so multi-byte text cannot bypass it and
	// legitimate multi-byte text at the limit is not falsely rejected.
	if _, err := SanitizeMessageBody(strings.Repeat("क", RoomMessageMaxRunes)); err != nil {
		t.Fatalf("multi-byte message at limit rejected: %v", err)
	}
	if _, err := SanitizeMessageBody(strings.Repeat("क", RoomMessageMaxRunes+1)); err != ErrMessageLong {
		t.Fatalf("over-limit err = %v", err)
	}
}

func TestNormalizeMentions(t *testing.T) {
	author := primitive.NewObjectID()
	one, two := primitive.NewObjectID(), primitive.NewObjectID()
	mentions, err := NormalizeMentions([]primitive.ObjectID{one, one, two, author, primitive.NilObjectID}, author)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(mentions) != 2 {
		t.Fatalf("mentions = %#v, want de-duplicated without self/zero", mentions)
	}
	tooMany := make([]primitive.ObjectID, RoomMaxMentions+1)
	for index := range tooMany {
		tooMany[index] = primitive.NewObjectID()
	}
	if _, err := NormalizeMentions(tooMany, author); err != ErrMessageMentions {
		t.Fatalf("over-cap err = %v", err)
	}
}

func TestIsDuplicateMessage(t *testing.T) {
	now := time.Now().UTC()
	if !IsDuplicateMessage("hi", now.Add(-5*time.Second), "hi", now) {
		t.Fatal("identical message inside the window was allowed")
	}
	if IsDuplicateMessage("hi", now.Add(-31*time.Second), "hi", now) {
		t.Fatal("identical message outside the window was blocked")
	}
	if IsDuplicateMessage("hi", now, "different", now) {
		t.Fatal("different text was treated as duplicate")
	}
	if IsDuplicateMessage("", now, "first message", now) {
		t.Fatal("first message treated as duplicate")
	}
}

func TestValidateSessionInput(t *testing.T) {
	if _, err := ValidateSessionInput("telepathy", 25, ""); err != ErrSessionMode {
		t.Fatalf("mode err = %v", err)
	}
	if _, err := ValidateSessionInput(SessionModePomodoro, SessionMinMinutes-1, ""); err != ErrSessionMinutes {
		t.Fatalf("short session err = %v", err)
	}
	if _, err := ValidateSessionInput(SessionModeDeepWork, SessionMaxMinutes+1, ""); err != ErrSessionMinutes {
		t.Fatalf("long session err = %v", err)
	}
	if _, err := ValidateSessionInput(SessionModeCustom, 25, strings.Repeat("t", SessionTopicMaxRune+1)); err != ErrSessionTopicLong {
		t.Fatalf("long topic err = %v", err)
	}
	topic, err := ValidateSessionInput(SessionModePomodoro, 25, "  Trees   and Graphs ")
	if err != nil || topic != "Trees and Graphs" {
		t.Fatalf("topic = %q err = %v", topic, err)
	}
}

func TestSessionStatusIsDerivedFromTheClock(t *testing.T) {
	now := time.Now().UTC()
	session := RoomSession{StartsAt: now.Add(time.Minute), EndsAt: now.Add(26 * time.Minute)}
	if got := SessionStatusAt(session, now); got != SessionStatusScheduled {
		t.Fatalf("before start = %q", got)
	}
	if got := SessionStatusAt(session, now.Add(2*time.Minute)); got != SessionStatusActive {
		t.Fatalf("during = %q", got)
	}
	// Derived status is what stops a missed job from leaving a session "active".
	if got := SessionStatusAt(session, now.Add(90*time.Minute)); got != SessionStatusEnded {
		t.Fatalf("after end = %q", got)
	}
}

func TestPresenceExpiryAndLiveness(t *testing.T) {
	now := time.Now().UTC()
	expiry := PresenceExpiry(now)
	if !expiry.After(now.Add(PresenceHeartbeatInterval)) {
		t.Fatal("presence TTL must outlive one heartbeat interval or desks will flicker")
	}
	live := RoomPresence{ExpiresAt: expiry}
	if !IsPresenceLive(live, now) {
		t.Fatal("fresh heartbeat treated as offline")
	}
	stale := RoomPresence{ExpiresAt: now.Add(-time.Second)}
	if IsPresenceLive(stale, now) {
		t.Fatal("expired presence treated as live")
	}
}

func TestSessionXP(t *testing.T) {
	if xp := SessionXP(SessionOutcomeMissed, 60); xp != 0 {
		t.Fatalf("missed xp = %d, want 0", xp)
	}
	if xp := SessionXP("nonsense", 60); xp != 0 {
		t.Fatalf("unknown outcome xp = %d, want 0", xp)
	}
	completed := SessionXP(SessionOutcomeCompleted, 50)
	partial := SessionXP(SessionOutcomePartial, 50)
	if completed <= partial {
		t.Fatalf("completed(%d) must beat partial(%d)", completed, partial)
	}
	// Reporting "partial" honestly must beat reporting nothing, or the
	// accountability prompt trains users to lie.
	if partial <= SessionXP(SessionOutcomeMissed, 50) {
		t.Fatal("partial credit must beat a missed session")
	}
	if xp := SessionXP(SessionOutcomeCompleted, 100000); xp != XPMaxPerSession {
		t.Fatalf("xp = %d, want clamp at %d", xp, XPMaxPerSession)
	}
	if xp := SessionXP(SessionOutcomeCompleted, -5); xp != XPSessionCompleted {
		t.Fatalf("negative minutes xp = %d", xp)
	}
}

func TestLevelCurveIsMonotonicAndBounded(t *testing.T) {
	if LevelForXP(0) != 1 || LevelForXP(-100) != 1 {
		t.Fatal("level must start at 1")
	}
	previous := 0
	for xp := 0; xp <= 200000; xp += 137 {
		level := LevelForXP(xp)
		if level < previous {
			t.Fatalf("level decreased at xp=%d", xp)
		}
		previous = level
	}
	if LevelForXP(100) <= LevelForXP(99) {
		t.Fatal("crossing the first threshold must level up")
	}
	for _, xp := range []int{0, 50, 99, 100, 1000, 50000} {
		if next := XPForNextLevel(xp); next <= xp {
			t.Fatalf("XPForNextLevel(%d) = %d must exceed current xp", xp, next)
		}
	}
}

func TestEvaluateRoomAchievements(t *testing.T) {
	none := EvaluateRoomAchievements(RoomAchievementMetrics{})
	if len(none) != 0 {
		t.Fatalf("earned %#v with zero metrics", none)
	}
	earned := EvaluateRoomAchievements(RoomAchievementMetrics{
		SessionsCompleted: 1, StudyMinutes: 100 * 60, Streak: 7, RoomsJoined: 3, LeaderboardTop: true,
	})
	if len(earned) != len(RoomAchievementRules) {
		t.Fatalf("earned %d of %d rules", len(earned), len(RoomAchievementRules))
	}
	// The registry is the extension point: every rule needs an id and a predicate.
	seen := make(map[string]struct{}, len(RoomAchievementRules))
	for _, rule := range RoomAchievementRules {
		if rule.ID == "" || rule.Title == "" || rule.Matches == nil {
			t.Fatalf("incomplete rule %#v", rule.ID)
		}
		if _, duplicate := seen[rule.ID]; duplicate {
			t.Fatalf("duplicate achievement id %q", rule.ID)
		}
		seen[rule.ID] = struct{}{}
	}
}

func TestLeaderboardPeriodStart(t *testing.T) {
	// Wednesday 2026-09-16T14:05Z
	now := time.Date(2026, 9, 16, 14, 5, 0, 0, time.UTC)
	daily := LeaderboardPeriodStart("daily", now)
	if !daily.Equal(time.Date(2026, 9, 16, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("daily bucket = %s", daily)
	}
	weekly := LeaderboardPeriodStart("weekly", now)
	if !weekly.Equal(time.Date(2026, 9, 14, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("weekly bucket = %s, want Monday 2026-09-14", weekly)
	}
	// Sunday must belong to the week that started the previous Monday.
	sunday := time.Date(2026, 9, 20, 23, 59, 0, 0, time.UTC)
	if got := LeaderboardPeriodStart("weekly", sunday); !got.Equal(weekly) {
		t.Fatalf("Sunday bucket = %s, want %s", got, weekly)
	}
}

func TestProductivityScoreRewardsConsistency(t *testing.T) {
	grinder := ProductivityScore(300, 1, 1, 1)
	consistent := ProductivityScore(300, 5, 5, 5)
	if consistent <= grinder {
		t.Fatalf("consistent(%d) must outrank one-session(%d) at equal minutes", consistent, grinder)
	}
	if score := ProductivityScore(-10, 0, 0, 0); score != 0 {
		t.Fatalf("negative minutes score = %d", score)
	}
	// Completion ratio cannot exceed 1 even if a client reports more completions
	// than joins.
	if ProductivityScore(60, 99, 1, 1) != ProductivityScore(60, 1, 1, 1) {
		t.Fatal("completion ratio was not clamped to joined sessions")
	}
}

func TestReactionAndStateAllowlists(t *testing.T) {
	if !IsValidReaction("🔥") || IsValidReaction("🍆") || IsValidReaction("") {
		t.Fatal("reaction allowlist is wrong")
	}
	for _, state := range []string{PresenceOnline, PresenceStudying, PresenceDeepFocus, PresenceBreak, PresenceAway} {
		if !IsValidPresenceState(state) {
			t.Fatalf("state %q rejected", state)
		}
	}
	if IsValidPresenceState("invisible") || IsValidPresenceState("") {
		t.Fatal("unknown presence state accepted")
	}
	if !IsValidRoomCategory("programming") || IsValidRoomCategory("Programming") {
		t.Fatal("category allowlist must be exact and lowercase")
	}
	if !IsValidSessionOutcome(SessionOutcomePartial) || IsValidSessionOutcome("kinda") {
		t.Fatal("outcome allowlist is wrong")
	}
}
