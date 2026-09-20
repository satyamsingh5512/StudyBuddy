package models

// Study Rooms domain model.
//
// Every rule that decides *what is valid* or *who may act* lives here as a pure
// function so it has exactly one definition and can be unit tested without a
// MongoDB instance (matching how the rest of this backend is tested).
// HTTP handlers stay thin: parse, authorize, persist, respond.

import (
	"errors"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Room visibility. A room is exactly one of these; goal and elite rooms are
// publicly discoverable but carry extra join semantics.
const (
	RoomVisibilityPublic  = "public"
	RoomVisibilityPrivate = "private"
	RoomVisibilityGoal    = "goal"
	RoomVisibilityElite   = "elite"
)

// Membership roles, ordered by privilege.
const (
	RoomRoleOwner     = "owner"
	RoomRoleModerator = "moderator"
	RoomRoleMember    = "member"
)

// Membership status. Banned members keep their document so a ban survives a
// rejoin attempt.
const (
	RoomMemberActive  = "active"
	RoomMemberPending = "pending"
	RoomMemberBanned  = "banned"
)

// Presence states shown on the virtual desks.
const (
	PresenceOnline    = "online"
	PresenceStudying  = "studying"
	PresenceDeepFocus = "deep_focus"
	PresenceBreak     = "break"
	PresenceAway      = "away"
)

// Shared session modes and lifecycle.
const (
	SessionModePomodoro = "pomodoro"
	SessionModeCustom   = "custom"
	SessionModeDeepWork = "deep_work"

	SessionStatusScheduled = "scheduled"
	SessionStatusActive    = "active"
	SessionStatusEnded     = "ended"

	SessionOutcomeCompleted = "completed"
	SessionOutcomePartial   = "partial"
	SessionOutcomeMissed    = "missed"
)

// Limits. Rune-based (not byte-based) so multi-byte input cannot bypass a cap.
const (
	RoomNameMinRunes        = 3
	RoomNameMaxRunes        = 60
	RoomDescriptionMaxRunes = 500
	RoomRulesMaxRunes       = 1000
	RoomMaxTags             = 8
	RoomTagMaxRunes         = 24
	RoomGoalMaxRunes        = 160
	RoomMessageMaxRunes     = 2000
	RoomMaxMentions         = 10
	RoomMaxCoverURLBytes    = 2048
	RoomMemberCap           = 2000

	SessionMinMinutes   = 5
	SessionMaxMinutes   = 300
	SessionTopicMaxRune = 120

	// Presence expires rather than being explicitly cleared: absence of a
	// document means offline, so a crashed client cannot appear online forever.
	PresenceHeartbeatInterval = 30 * time.Second
	PresenceTTL               = 90 * time.Second
)

// RoomCategories is an allowlist. Free-text categories would fragment discovery
// and make the category index useless.
var RoomCategories = []string{
	"competitive-exam", "engineering", "medical", "programming",
	"school", "language", "university", "general",
}

// ReactionEmojis is an allowlist: arbitrary user-supplied "emoji" would let a
// client store unbounded keys inside a message document.
var ReactionEmojis = []string{"👍", "🔥", "🎯", "💪", "🧠", "👏", "😅", "❤️"}

var (
	ErrRoomNameLength      = errors.New("room name must be between 3 and 60 characters")
	ErrRoomNameInvalid     = errors.New("room name contains unsupported characters")
	ErrRoomDescriptionLong = errors.New("room description cannot exceed 500 characters")
	ErrRoomRulesLong       = errors.New("room rules cannot exceed 1000 characters")
	ErrRoomVisibility      = errors.New("room visibility is invalid")
	ErrRoomCategory        = errors.New("room category is invalid")
	ErrRoomTags            = errors.New("rooms accept at most 8 tags of 24 characters")
	ErrRoomCoverURL        = errors.New("cover image must be an https URL")
	ErrRoomGoalRequired    = errors.New("goal rooms require a goal description and target date")
	ErrRoomGoalLong        = errors.New("goal description cannot exceed 160 characters")
	ErrRoomGoalDate        = errors.New("goal target date must be in the future")
	ErrRoomEliteRequired   = errors.New("elite rooms require at least one entry requirement")
	ErrRoomEliteRange      = errors.New("elite entry requirements are out of range")
	ErrMessageEmpty        = errors.New("message cannot be empty")
	ErrMessageLong         = errors.New("message cannot exceed 2000 characters")
	ErrMessageMentions     = errors.New("a message can mention at most 10 members")
	ErrReactionInvalid     = errors.New("reaction is not supported")
	ErrPresenceState       = errors.New("presence state is invalid")
	ErrSessionMode         = errors.New("session mode is invalid")
	ErrSessionMinutes      = errors.New("session length must be between 5 and 300 minutes")
	ErrSessionTopicLong    = errors.New("session topic cannot exceed 120 characters")
	ErrSessionOutcome      = errors.New("session outcome is invalid")
	ErrRoomFull            = errors.New("room has reached its member capacity")
)

// EntryRequirements gates Elite rooms. Zero means "not required", so an owner
// can require any subset.
type EntryRequirements struct {
	MinStudyMinutes int `bson:"minStudyMinutes" json:"minStudyMinutes"`
	MinPoints       int `bson:"minPoints" json:"minPoints"`
	MinStreak       int `bson:"minStreak" json:"minStreak"`
}

// RoomGoal describes a goal-based room's objective.
type RoomGoal struct {
	Description string     `bson:"description" json:"description"`
	TargetDate  *time.Time `bson:"targetDate,omitempty" json:"targetDate,omitempty"`
	TargetHours int        `bson:"targetHours" json:"targetHours"`
}

// StudyRoom is the room document. Counters are denormalized because discovery
// sorts on them; recomputing per request would be an N+1 aggregation.
type StudyRoom struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name              string             `bson:"name" json:"name"`
	Slug              string             `bson:"slug" json:"slug"`
	Description       string             `bson:"description" json:"description"`
	Category          string             `bson:"category" json:"category"`
	Tags              []string           `bson:"tags" json:"tags"`
	Rules             string             `bson:"rules,omitempty" json:"rules,omitempty"`
	CoverImageURL     string             `bson:"coverImageUrl,omitempty" json:"coverImageUrl,omitempty"`
	Visibility        string             `bson:"visibility" json:"visibility"`
	OwnerID           primitive.ObjectID `bson:"ownerId" json:"ownerId"`
	Goal              *RoomGoal          `bson:"goal,omitempty" json:"goal,omitempty"`
	Requirements      *EntryRequirements `bson:"requirements,omitempty" json:"requirements,omitempty"`
	InviteCode        string             `bson:"inviteCode,omitempty" json:"-"`
	MemberCount       int                `bson:"memberCount" json:"memberCount"`
	TotalStudyMinutes int                `bson:"totalStudyMinutes" json:"totalStudyMinutes"`
	SessionsHosted    int                `bson:"sessionsHosted" json:"sessionsHosted"`
	MessageCount      int                `bson:"messageCount" json:"messageCount"`
	Archived          bool               `bson:"archived" json:"archived"`
	LastActivityAt    time.Time          `bson:"lastActivityAt" json:"lastActivityAt"`
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// RoomMember is the authorization edge and the per-room contribution record.
type RoomMember struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RoomID            primitive.ObjectID `bson:"roomId" json:"roomId"`
	UserID            primitive.ObjectID `bson:"userId" json:"userId"`
	Role              string             `bson:"role" json:"role"`
	Status            string             `bson:"status" json:"status"`
	StudyMinutes      int                `bson:"studyMinutes" json:"studyMinutes"`
	SessionsCompleted int                `bson:"sessionsCompleted" json:"sessionsCompleted"`
	XP                int                `bson:"xp" json:"xp"`
	JoinedAt          time.Time          `bson:"joinedAt" json:"joinedAt"`
	LastSeenAt        time.Time          `bson:"lastSeenAt" json:"lastSeenAt"`
}

// RoomPresence is high-churn data kept out of RoomMember so presence writes
// never touch the authorization-critical document. Mongo's TTL monitor removes
// expired docs, so "offline" needs no writer.
type RoomPresence struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RoomID           primitive.ObjectID `bson:"roomId" json:"roomId"`
	UserID           primitive.ObjectID `bson:"userId" json:"userId"`
	State            string             `bson:"state" json:"state"`
	FocusMinutes     int                `bson:"focusMinutes" json:"focusMinutes"`
	SessionStartedAt *time.Time         `bson:"sessionStartedAt,omitempty" json:"sessionStartedAt,omitempty"`
	UpdatedAt        time.Time          `bson:"updatedAt" json:"updatedAt"`
	ExpiresAt        time.Time          `bson:"expiresAt" json:"expiresAt"`
}

// RoomSession is a server-authoritative shared focus session. Clients render a
// countdown from StartsAt; they never decide it, otherwise "together" drifts.
type RoomSession struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RoomID           primitive.ObjectID `bson:"roomId" json:"roomId"`
	HostID           primitive.ObjectID `bson:"hostId" json:"hostId"`
	Mode             string             `bson:"mode" json:"mode"`
	Topic            string             `bson:"topic,omitempty" json:"topic,omitempty"`
	PlannedMinutes   int                `bson:"plannedMinutes" json:"plannedMinutes"`
	StartsAt         time.Time          `bson:"startsAt" json:"startsAt"`
	EndsAt           time.Time          `bson:"endsAt" json:"endsAt"`
	Status           string             `bson:"status" json:"status"`
	ParticipantCount int                `bson:"participantCount" json:"participantCount"`
	CompletedCount   int                `bson:"completedCount" json:"completedCount"`
	CreatedAt        time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt        time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// RoomSessionParticipant is the accountability record: declared intent before,
// self-reported outcome after.
type RoomSessionParticipant struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SessionID     primitive.ObjectID `bson:"sessionId" json:"sessionId"`
	RoomID        primitive.ObjectID `bson:"roomId" json:"roomId"`
	UserID        primitive.ObjectID `bson:"userId" json:"userId"`
	DeclaredGoal  string             `bson:"declaredGoal,omitempty" json:"declaredGoal,omitempty"`
	DeclaredTopic string             `bson:"declaredTopic,omitempty" json:"declaredTopic,omitempty"`
	DeclaredMins  int                `bson:"declaredMinutes" json:"declaredMinutes"`
	Outcome       string             `bson:"outcome,omitempty" json:"outcome,omitempty"`
	ActualMinutes int                `bson:"actualMinutes" json:"actualMinutes"`
	XPAwarded     int                `bson:"xpAwarded" json:"xpAwarded"`
	JoinedAt      time.Time          `bson:"joinedAt" json:"joinedAt"`
	CompletedAt   *time.Time         `bson:"completedAt,omitempty" json:"completedAt,omitempty"`
}

// RoomMessage stores chat. Reactions are embedded (bounded, always read with the
// message); messages themselves are paginated by _id because they are unbounded.
type RoomMessage struct {
	ID        primitive.ObjectID              `bson:"_id,omitempty" json:"id"`
	RoomID    primitive.ObjectID              `bson:"roomId" json:"roomId"`
	UserID    primitive.ObjectID              `bson:"userId" json:"userId"`
	Body      string                          `bson:"body" json:"body"`
	ReplyToID *primitive.ObjectID             `bson:"replyToId,omitempty" json:"replyToId,omitempty"`
	Mentions  []primitive.ObjectID            `bson:"mentions,omitempty" json:"mentions,omitempty"`
	Reactions map[string][]primitive.ObjectID `bson:"reactions,omitempty" json:"reactions,omitempty"`
	Pinned    bool                            `bson:"pinned" json:"pinned"`
	Deleted   bool                            `bson:"deleted" json:"deleted"`
	DeletedBy *primitive.ObjectID             `bson:"deletedBy,omitempty" json:"deletedBy,omitempty"`
	CreatedAt time.Time                       `bson:"createdAt" json:"createdAt"`
}

// RoomResource backs the Resource Vault. The schema and its index ship now so
// endpoints can be added later without a migration.
type RoomResource struct {
	ID          primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	RoomID      primitive.ObjectID  `bson:"roomId" json:"roomId"`
	AddedBy     primitive.ObjectID  `bson:"addedBy" json:"addedBy"`
	Kind        string              `bson:"kind" json:"kind"`
	Title       string              `bson:"title" json:"title"`
	Description string              `bson:"description,omitempty" json:"description,omitempty"`
	URL         string              `bson:"url,omitempty" json:"url,omitempty"`
	NoteID      *primitive.ObjectID `bson:"noteId,omitempty" json:"noteId,omitempty"`
	CreatedAt   time.Time           `bson:"createdAt" json:"createdAt"`
}

// RoomInput is the create/update DTO.
type RoomInput struct {
	Name          string             `json:"name"`
	Description   string             `json:"description"`
	Category      string             `json:"category"`
	Tags          []string           `json:"tags"`
	Rules         string             `json:"rules"`
	CoverImageURL string             `json:"coverImageUrl"`
	Visibility    string             `json:"visibility"`
	Goal          *RoomGoal          `json:"goal"`
	Requirements  *EntryRequirements `json:"requirements"`
}

var (
	// \p{M} (combining marks) is required alongside \p{L}: Indic scripts write
	// vowel signs as marks, so "गणित मास्टरी" is letters + marks and would be
	// rejected by a letters-only class. This is an Indian exam-prep product.
	roomNamePattern = regexp.MustCompile(`^[\p{L}\p{M}\p{N} _.,'&()+/-]+$`)
	roomTagPattern  = regexp.MustCompile(`^[a-z0-9-]+$`)
	slugStripper    = regexp.MustCompile(`[^a-z0-9]+`)
)

func runeLen(value string) int { return utf8.RuneCountInString(value) }

// collapseWhitespace trims and collapses runs of whitespace, including the
// zero-width and control characters used to fake an "empty" name or to pad a
// message past a visual limit.
func collapseWhitespace(value string) string {
	var builder strings.Builder
	builder.Grow(len(value))
	lastWasSpace := false
	for _, r := range value {
		switch {
		case r == '\u200b' || r == '\u200c' || r == '\u200d' || r == '\ufeff':
			continue
		case unicode.IsSpace(r):
			if !lastWasSpace {
				builder.WriteRune(' ')
			}
			lastWasSpace = true
		case unicode.IsControl(r):
			continue
		default:
			builder.WriteRune(r)
			lastWasSpace = false
		}
	}
	return strings.TrimSpace(builder.String())
}

// NormalizeTags lowercases, de-duplicates and sorts tags so the tag index is
// effective and "DSA" / "dsa" are one tag.
func NormalizeTags(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	normalized := make([]string, 0, len(tags))
	for _, tag := range tags {
		clean := strings.ToLower(collapseWhitespace(tag))
		clean = strings.ReplaceAll(clean, " ", "-")
		if clean == "" {
			continue
		}
		if _, exists := seen[clean]; exists {
			continue
		}
		seen[clean] = struct{}{}
		normalized = append(normalized, clean)
	}
	sort.Strings(normalized)
	return normalized
}

// Slugify produces the discovery-friendly slug. It is not unique on its own;
// handlers append a short suffix from the ObjectId.
func Slugify(name string) string {
	slug := slugStripper.ReplaceAllString(strings.ToLower(collapseWhitespace(name)), "-")
	slug = strings.Trim(slug, "-")
	if runeLen(slug) > RoomNameMaxRunes {
		slug = string([]rune(slug)[:RoomNameMaxRunes])
	}
	return slug
}

// IsValidRoomCategory reports whether category is in the allowlist.
func IsValidRoomCategory(category string) bool {
	for _, allowed := range RoomCategories {
		if category == allowed {
			return true
		}
	}
	return false
}

// IsValidRoomVisibility reports whether visibility is one of the four types.
func IsValidRoomVisibility(visibility string) bool {
	switch visibility {
	case RoomVisibilityPublic, RoomVisibilityPrivate, RoomVisibilityGoal, RoomVisibilityElite:
		return true
	}
	return false
}

// IsValidPresenceState reports whether state is a known desk state.
func IsValidPresenceState(state string) bool {
	switch state {
	case PresenceOnline, PresenceStudying, PresenceDeepFocus, PresenceBreak, PresenceAway:
		return true
	}
	return false
}

// IsValidSessionMode reports whether mode is a supported timer mode.
func IsValidSessionMode(mode string) bool {
	switch mode {
	case SessionModePomodoro, SessionModeCustom, SessionModeDeepWork:
		return true
	}
	return false
}

// IsValidSessionOutcome reports whether outcome is a supported self-report.
func IsValidSessionOutcome(outcome string) bool {
	switch outcome {
	case SessionOutcomeCompleted, SessionOutcomePartial, SessionOutcomeMissed:
		return true
	}
	return false
}

// IsValidReaction reports whether emoji is in the reaction allowlist.
func IsValidReaction(emoji string) bool {
	for _, allowed := range ReactionEmojis {
		if emoji == allowed {
			return true
		}
	}
	return false
}

// validateCoverURL requires https so a room cover cannot downgrade the page to
// mixed content, and bounds the length so the document stays small.
func validateCoverURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	if len(trimmed) > RoomMaxCoverURLBytes {
		return "", ErrRoomCoverURL
	}
	parsed, err := url.ParseRequestURI(trimmed)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return "", ErrRoomCoverURL
	}
	return trimmed, nil
}

// ValidateRoomInput normalizes and validates a create/update payload. It returns
// the sanitized input so handlers persist normalized data, never raw user bytes.
func ValidateRoomInput(input RoomInput, now time.Time) (RoomInput, error) {
	clean := RoomInput{
		Name:        collapseWhitespace(input.Name),
		Description: collapseWhitespace(input.Description),
		Rules:       strings.TrimSpace(input.Rules),
		Category:    strings.ToLower(strings.TrimSpace(input.Category)),
		Visibility:  strings.ToLower(strings.TrimSpace(input.Visibility)),
	}

	if length := runeLen(clean.Name); length < RoomNameMinRunes || length > RoomNameMaxRunes {
		return RoomInput{}, ErrRoomNameLength
	}
	if !roomNamePattern.MatchString(clean.Name) {
		return RoomInput{}, ErrRoomNameInvalid
	}
	if runeLen(clean.Description) > RoomDescriptionMaxRunes {
		return RoomInput{}, ErrRoomDescriptionLong
	}
	if runeLen(clean.Rules) > RoomRulesMaxRunes {
		return RoomInput{}, ErrRoomRulesLong
	}
	if !IsValidRoomVisibility(clean.Visibility) {
		return RoomInput{}, ErrRoomVisibility
	}
	if !IsValidRoomCategory(clean.Category) {
		return RoomInput{}, ErrRoomCategory
	}

	clean.Tags = NormalizeTags(input.Tags)
	if len(clean.Tags) > RoomMaxTags {
		return RoomInput{}, ErrRoomTags
	}
	for _, tag := range clean.Tags {
		if runeLen(tag) > RoomTagMaxRunes || !roomTagPattern.MatchString(tag) {
			return RoomInput{}, ErrRoomTags
		}
	}

	cover, err := validateCoverURL(input.CoverImageURL)
	if err != nil {
		return RoomInput{}, err
	}
	clean.CoverImageURL = cover

	if clean.Visibility == RoomVisibilityGoal {
		if input.Goal == nil {
			return RoomInput{}, ErrRoomGoalRequired
		}
		goal := RoomGoal{
			Description: collapseWhitespace(input.Goal.Description),
			TargetDate:  input.Goal.TargetDate,
			TargetHours: input.Goal.TargetHours,
		}
		if goal.Description == "" || goal.TargetDate == nil {
			return RoomInput{}, ErrRoomGoalRequired
		}
		if runeLen(goal.Description) > RoomGoalMaxRunes {
			return RoomInput{}, ErrRoomGoalLong
		}
		if !goal.TargetDate.After(now) {
			return RoomInput{}, ErrRoomGoalDate
		}
		if goal.TargetHours < 0 || goal.TargetHours > 10000 {
			return RoomInput{}, ErrRoomEliteRange
		}
		clean.Goal = &goal
	}

	if clean.Visibility == RoomVisibilityElite {
		if input.Requirements == nil {
			return RoomInput{}, ErrRoomEliteRequired
		}
		requirements := *input.Requirements
		if requirements.MinStudyMinutes == 0 && requirements.MinPoints == 0 && requirements.MinStreak == 0 {
			return RoomInput{}, ErrRoomEliteRequired
		}
		if requirements.MinStudyMinutes < 0 || requirements.MinStudyMinutes > 1_000_000 ||
			requirements.MinPoints < 0 || requirements.MinPoints > 1_000_000 ||
			requirements.MinStreak < 0 || requirements.MinStreak > 3650 {
			return RoomInput{}, ErrRoomEliteRange
		}
		clean.Requirements = &requirements
	}

	return clean, nil
}

// MeetsEntryRequirements reports whether a user clears an Elite room's bar, and
// returns the unmet reasons so the UI can tell the user what to improve instead
// of showing a bare "denied".
func MeetsEntryRequirements(requirements *EntryRequirements, user User) (bool, []string) {
	if requirements == nil {
		return true, nil
	}
	reasons := make([]string, 0, 3)
	if requirements.MinStudyMinutes > 0 && user.TotalStudyMins < requirements.MinStudyMinutes {
		reasons = append(reasons, "minimum study time not reached")
	}
	if requirements.MinPoints > 0 && user.TotalPoints < requirements.MinPoints {
		reasons = append(reasons, "minimum XP not reached")
	}
	if requirements.MinStreak > 0 && user.Streak < requirements.MinStreak {
		reasons = append(reasons, "minimum streak not reached")
	}
	return len(reasons) == 0, reasons
}

// CanJoinRoom centralizes join gating: archived rooms and private rooms without a
// matching invite code are refused, elite requirements are enforced, and the
// member cap is honoured.
func CanJoinRoom(room StudyRoom, user User, inviteCode string) (bool, string) {
	if room.Archived {
		return false, "room is archived"
	}
	if room.MemberCount >= RoomMemberCap {
		return false, ErrRoomFull.Error()
	}
	if room.Visibility == RoomVisibilityPrivate {
		if room.InviteCode == "" || strings.TrimSpace(inviteCode) != room.InviteCode {
			return false, "a valid invite is required"
		}
	}
	if room.Visibility == RoomVisibilityElite {
		if ok, reasons := MeetsEntryRequirements(room.Requirements, user); !ok {
			return false, strings.Join(reasons, ", ")
		}
	}
	return true, ""
}

// RoleRank orders privileges so comparisons are explicit rather than stringly.
func RoleRank(role string) int {
	switch role {
	case RoomRoleOwner:
		return 3
	case RoomRoleModerator:
		return 2
	case RoomRoleMember:
		return 1
	}
	return 0
}

// CanModerate reports whether the role may delete messages, pin, and ban members.
func CanModerate(role string) bool { return RoleRank(role) >= RoleRank(RoomRoleModerator) }

// CanAdministerRoom reports whether the role may change visibility, entry
// requirements, roles, or archive the room. Owners only.
func CanAdministerRoom(role string) bool { return RoleRank(role) >= RoleRank(RoomRoleOwner) }

// CanDeleteMessage allows a message author to remove their own message and
// moderators to remove anyone's.
func CanDeleteMessage(actorID, authorID primitive.ObjectID, actorRole string) bool {
	return actorID == authorID || CanModerate(actorRole)
}

// CanAssignRole prevents privilege escalation: only an owner may change roles,
// nobody may mint another owner through this path (ownership transfer is its own
// operation), and nobody may change their own role.
func CanAssignRole(actorRole string, actorID, targetID primitive.ObjectID, newRole string) bool {
	if !CanAdministerRoom(actorRole) || actorID == targetID {
		return false
	}
	return newRole == RoomRoleModerator || newRole == RoomRoleMember
}

// SanitizeMessageBody trims, strips zero-width padding, and enforces the rune
// cap. It returns the text to store; mention/reply validation is separate.
func SanitizeMessageBody(body string) (string, error) {
	clean := collapseWhitespace(body)
	if clean == "" {
		return "", ErrMessageEmpty
	}
	if runeLen(clean) > RoomMessageMaxRunes {
		return "", ErrMessageLong
	}
	return clean, nil
}

// NormalizeMentions de-duplicates mentions, drops self-mentions, and enforces the
// cap so one message cannot notify an entire room.
func NormalizeMentions(raw []primitive.ObjectID, author primitive.ObjectID) ([]primitive.ObjectID, error) {
	if len(raw) > RoomMaxMentions*4 {
		return nil, ErrMessageMentions
	}
	seen := make(map[primitive.ObjectID]struct{}, len(raw))
	mentions := make([]primitive.ObjectID, 0, len(raw))
	for _, id := range raw {
		if id.IsZero() || id == author {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		mentions = append(mentions, id)
	}
	if len(mentions) > RoomMaxMentions {
		return nil, ErrMessageMentions
	}
	return mentions, nil
}

// IsDuplicateMessage rejects a resend of the same text within a short window,
// which is the cheapest effective spam brake and also swallows double-taps.
func IsDuplicateMessage(previousBody string, previousAt time.Time, body string, now time.Time) bool {
	if previousBody == "" || previousBody != body {
		return false
	}
	return now.Sub(previousAt) < 30*time.Second
}

// ValidateSessionInput validates a shared session request.
func ValidateSessionInput(mode string, minutes int, topic string) (string, error) {
	if !IsValidSessionMode(mode) {
		return "", ErrSessionMode
	}
	if minutes < SessionMinMinutes || minutes > SessionMaxMinutes {
		return "", ErrSessionMinutes
	}
	clean := collapseWhitespace(topic)
	if runeLen(clean) > SessionTopicMaxRune {
		return "", ErrSessionTopicLong
	}
	return clean, nil
}

// SessionStatusAt derives status from the clock so a missed cron job can never
// leave a session "active" forever. Status is computed, not trusted.
func SessionStatusAt(session RoomSession, now time.Time) string {
	switch {
	case now.Before(session.StartsAt):
		return SessionStatusScheduled
	case now.Before(session.EndsAt):
		return SessionStatusActive
	default:
		return SessionStatusEnded
	}
}

// PresenceExpiry returns the TTL deadline for a heartbeat received at now.
func PresenceExpiry(now time.Time) time.Time { return now.Add(PresenceTTL) }

// IsPresenceLive reports whether a presence document is still current. Used when
// rendering desks so a document the TTL monitor has not collected yet (Mongo
// sweeps roughly every 60s) is still treated as offline.
func IsPresenceLive(presence RoomPresence, now time.Time) bool {
	return presence.ExpiresAt.After(now)
}

// XP award table. Kept as data so the curve is tunable without touching logic.
const (
	XPPerFocusMinute        = 1
	XPSessionCompleted      = 25
	XPSessionPartial        = 10
	XPRoomMessage           = 1
	XPDailyStreakBonus      = 15
	XPMaxPerSession         = 400
	xpMessagesCountedPerDay = 20
)

// SessionXP computes the XP for a completed shared session. Partial credit keeps
// honest self-reporting rational: reporting "partial" must beat reporting nothing.
func SessionXP(outcome string, actualMinutes int) int {
	if actualMinutes < 0 {
		actualMinutes = 0
	}
	xp := actualMinutes * XPPerFocusMinute
	switch outcome {
	case SessionOutcomeCompleted:
		xp += XPSessionCompleted
	case SessionOutcomePartial:
		xp += XPSessionPartial
	case SessionOutcomeMissed:
		xp = 0
	default:
		return 0
	}
	if xp > XPMaxPerSession {
		xp = XPMaxPerSession
	}
	return xp
}

// LevelForXP is the progressive level curve: each level costs 20% more than the
// previous one. Pure and cheap so it can run on either side of the wire.
func LevelForXP(xp int) int {
	if xp <= 0 {
		return 1
	}
	level, threshold, step := 1, 0, 100
	for xp >= threshold+step && level < 200 {
		threshold += step
		step = step * 12 / 10
		level++
	}
	return level
}

// XPForNextLevel returns the XP total required to reach the next level, so the UI
// can render a progress bar without duplicating the curve.
func XPForNextLevel(xp int) int {
	if xp < 0 {
		xp = 0
	}
	threshold, step := 0, 100
	for {
		if xp < threshold+step {
			return threshold + step
		}
		threshold += step
		step = step * 12 / 10
		if threshold > 10_000_000 {
			return threshold
		}
	}
}

// AchievementRule is the extensible achievement engine: a rule is data plus a
// predicate over a metric snapshot, so new achievements are one slice entry and
// need no changes to the evaluation loop.
type AchievementRule struct {
	ID          string
	Title       string
	Description string
	Matches     func(RoomAchievementMetrics) bool
}

// RoomAchievementMetrics is the snapshot an achievement rule sees.
type RoomAchievementMetrics struct {
	SessionsCompleted int
	StudyMinutes      int
	Streak            int
	RoomsJoined       int
	MessagesPosted    int
	LeaderboardTop    bool
}

// RoomAchievementRules is evaluated in order; adding an achievement is additive
// and cannot change how existing ones are decided.
var RoomAchievementRules = []AchievementRule{
	{
		ID: "room-first-session", Title: "First Session", Description: "Completed your first shared room session",
		Matches: func(m RoomAchievementMetrics) bool { return m.SessionsCompleted >= 1 },
	},
	{
		ID: "room-streak-7", Title: "7 Day Streak", Description: "Studied seven days in a row",
		Matches: func(m RoomAchievementMetrics) bool { return m.Streak >= 7 },
	},
	{
		ID: "room-100-hours", Title: "100 Study Hours", Description: "Logged 100 hours of focused study",
		Matches: func(m RoomAchievementMetrics) bool { return m.StudyMinutes >= 100*60 },
	},
	{
		ID: "room-top-performer", Title: "Top Performer", Description: "Finished first on a room leaderboard",
		Matches: func(m RoomAchievementMetrics) bool { return m.LeaderboardTop },
	},
	{
		ID: "room-community", Title: "Community Builder", Description: "Joined three study rooms",
		Matches: func(m RoomAchievementMetrics) bool { return m.RoomsJoined >= 3 },
	},
}

// EvaluateRoomAchievements returns the IDs a metric snapshot has earned.
func EvaluateRoomAchievements(metrics RoomAchievementMetrics) []string {
	earned := make([]string, 0, len(RoomAchievementRules))
	for _, rule := range RoomAchievementRules {
		if rule.Matches(metrics) {
			earned = append(earned, rule.ID)
		}
	}
	return earned
}

// LeaderboardPeriodStart returns the UTC bucket start for a leaderboard period.
// Weekly buckets start Monday, matching the weekly check-in feature.
func LeaderboardPeriodStart(period string, now time.Time) time.Time {
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	if period != "weekly" {
		return day
	}
	offset := (int(day.Weekday()) + 6) % 7 // Monday = 0
	return day.AddDate(0, 0, -offset)
}

// ProductivityScore blends focus time with follow-through so the weekly board
// rewards consistency rather than one heroic session.
func ProductivityScore(focusMinutes, sessionsCompleted, sessionsJoined, activeDays int) int {
	if focusMinutes < 0 || sessionsJoined < 0 {
		return 0
	}
	score := focusMinutes
	if sessionsJoined > 0 {
		if sessionsCompleted > sessionsJoined {
			sessionsCompleted = sessionsJoined
		}
		score += sessionsCompleted * 100 / sessionsJoined * 2
	}
	if activeDays > 0 {
		score += activeDays * 20
	}
	return score
}
