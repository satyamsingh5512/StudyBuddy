# Product interaction reference

This document records behavior observed in an authenticated goals/productivity application during the StudyBuddy workflow redesign and maps it to the current StudyBuddy product. It excludes credentials, cookies, tokens, private request headers, account identifiers, and proprietary source code.

## Reference interaction map

### Home
- Current date and a concise coaching brief.
- One selected goal card with momentum and weekly focus.
- Mobile-first shell with fixed primary navigation.

### Goals and daily show-up
- Reorderable goals created from custom input or templates.
- Target-date and open-ended timelines, daily/weekly cadence, sub-goals, and milestones.
- A day can auto-complete when every current sub-goal is complete or be marked complete/partial manually.
- Goal selector, bounded week calendar, disabled future dates, per-date checklist, momentum, streak, target, and weekday statistics.

### Tasks
- Single-field creation with Enter, immediate completion, and deletion.
- Deliberately narrower than StudyBuddy's full Todo model.

### Journal/log
- Date picker and previous/next navigation.
- Rich text, task insertion, image attachment, and browser dictation.
- Bold, italic, strikethrough (as the underline alternative), inline code (as the highlight alternative), link, bulleted-list, and numbered-list controls.

### Settings
- Mentor, achievements, tasks, widgets, preferences, help, installation, and logout.

## Current StudyBuddy implementation

### Goals, show-up, and tasks
StudyBuddy now has protected first-class goals, templates, target/open-ended timelines, daily/weekly grids, reorderable generation-fenced sub-goals, milestones, lifecycle controls, and bounded activity/stat endpoints. Automatic show-up requires all current sub-goals; manual complete/partial entries take precedence. The `/show-up` workspace provides a Monday–Sunday calendar, checklist dialog, momentum target/check-in, streaks, and weekday patterns with profile/request timezone handling.

The dedicated `/tasks` route supports quick Enter-to-add, completion, deletion, filtering, and optimistic entity-safe cache updates. The richer Todo model still supports subject, difficulty, question targets, scheduled dates, time ranges, overdue handling, rescheduling, points, and dashboard editing.

### Journal and Mentor
The protected `/journal` route is date-indexed and autosaves through revision-fenced writes with conflict recovery and local crash drafts. Its safe Markdown toolbar supports bold, italic, strikethrough as an underline alternative, inline code as a highlight alternative, links, bulleted lists, and numbered lists; it can create/insert tasks and upload, render, and delete private bounded image attachments.

Dictation uses browser `SpeechRecognition`/`webkitSpeechRecognition` when available. Final transcripts are inserted locally and StudyBuddy does not upload audio. Unsupported browsers, denied microphone permission, startup errors, and unexpected stops all leave typing available with an explicit fallback message.

The protected `/mentor` route provides an ephemeral read-only coaching thread and prompt chips. Requests receive bounded current StudyBuddy context: active goals, current-definition show-ups, tasks, study sessions, and reports. Up to seven recent journal entries are included only when the user enables the saved preference or the per-request override. Mentor cannot create, edit, complete, or delete account data.

### Achievements, dashboard, and preferences
The protected `/achievements` gallery derives streak and completed-goal milestones. The dashboard includes the overview, fixed floating timer, inseparable task/activity workspace, analytics access, compact daily summary, goal/schedule/leaderboard/check-in links, achievement preview, and Quick Show-up.

Only genuinely independent top-level sections are in the widget registry and Settings reorder/hide controls. The fixed overlay timer and combined task/activity workspace are deliberately not presented as independently reorderable. Saved widget order and hidden state are allowlisted on both client and server.

Quick Show-up calls the backend all-active-goals operation without sending a client-capped ID list. The response retains one result per goal, displays partial failures, updates matching show-up range caches, and invalidates successful goal activity/stat scopes.

Profile preferences include an IANA timezone, sans/mono/serif fonts, fourteen finite accessible accent choices with matching controls/CSS/backend validation, dashboard composition, foreground show-up schedule, and Mentor journal-context default.

### Reminder and PWA limits
Show-up and schedule reminders are foreground browser helpers. Their dedupe identities include a versioned namespace, authenticated user ID, local date, and reminder instance where applicable, so accounts sharing a browser do not suppress each other. In-app reminders work only while StudyBuddy is open. Browser notifications are optional, require an explicit action in Settings, and managers never request permission during mount or polling. There is no closed-app or background-delivery guarantee.

StudyBuddy is installable through its manifest and platform guidance in `/help`. Its service worker is intentionally static-only: it caches versioned public assets, never `/api` traffic, navigation HTML, authentication/private responses, schedules, or AI output. Authenticated pages and AI features require a network connection.

## Interaction and performance characteristics
- Flat surfaces, low-alpha hairline borders, responsive max-width content, and protected primary navigation.
- Reduced-motion support and compositor-friendly `transform`/`opacity` transitions.
- Narrow REST writes with optimistic updates where rollback and reconciliation are safe.
- Bounded list/range APIs and generation/revision fences for concurrent goal and journal edits.
- Dashboard behavior is preserved without advertising fixed or inseparable regions as reorderable.
