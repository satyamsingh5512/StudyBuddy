# Organization & Chat System

## Overview

Enhanced StudyBuddy with organization-based features, persistent login, and notification sounds.

## New Features

### 🏫 Organization System

**Three Types of Organizations:**

1. **Schools** - For school students (11th, 12th)
2. **Colleges** - For college/university students
3. **Coaching Institutes** - For coaching center students

**Features:**
- Search existing organizations
- Create new organizations
- Auto-complete suggestions
- City and state information
- Organization-specific chat rooms

### 💬 Multi-Level Chat System

**Three Chat Levels:**

1. **Global Chat** - All students across platform
2. **Organization Chat** - Students from same school/college/coaching
3. **Private Messages** - Coming soon

**Features:**
- Real-time messaging
- Organization-based rooms
- Message notifications
- Sound alerts
- Rate limiting per room

### 🔔 Notification Sounds

**Sound Types:**

1. **Message Notification** - Two-tone pleasant sound
2. **New Notification** - Ascending tone
3. **Theme Toggle** - Existing
4. **Click** - Existing

**Controls:**
- Enable/disable sounds
- Persistent preference
- Per-notification type control

### 🔐 Persistent Login

**Features:**
- Browser remembers login
- Session persistence
- Auto-login on return
- Secure token storage
- Last active tracking

## Database Schema

### Organization Models

```prisma
model School {
  id        String
  name      String
  city      String?
  state     String?
  users     User[]
  messages  SchoolMessage[]
}

model College {
  id        String
  name      String
  city      String?
  state     String?
  users     User[]
  messages  CollegeMessage[]
}

model Coaching {
  id        String
  name      String
  city      String?
  state     String?
  users     User[]
  messages  CoachingMessage[]
}
```

### Message Models

```prisma
model SchoolMessage {
  id        String
  userId    String
  schoolId  String
  message   String
  createdAt DateTime
}

model CollegeMessage {
  id        String
  userId    String
  collegeId String
  message   String
  createdAt DateTime
}

model CoachingMessage {
  id        String
  userId    String
  coachingId String
  message   String
  createdAt DateTime
}
```

### User Updates

```prisma
model User {
  schoolId    String?
  collegeId   String?
  coachingId  String?
  lastActive  DateTime
  // ... existing fields
}
```

## Onboarding Flow

### Enhanced Steps:

**Step 1:** Username & Avatar
**Step 2:** Exam Details
**Step 3:** Organization Selection ⭐ NEW
**Step 4:** Complete Setup

### Step 3: Organization Selection

**Choose Type:**
- School
- College
- Coaching Institute
- None (skip)

**Search or Create:**
1. Search existing organizations
2. Select from results
3. Or create new organization

**New Organization Form:**
- Organization name
- City
- State

## API Endpoints

### Organizations

**GET `/api/organizations/search`**
```json
{
  "type": "school",
  "query": "Delhi Public"
}
```

**POST `/api/organizations/create`**
```json
{
  "type": "school",
  "name": "Delhi Public School",
  "city": "Delhi",
  "state": "Delhi"
}
```

### Chat

**GET `/api/chat/school/:schoolId`** - Get school messages
**GET `/api/chat/college/:collegeId`** - Get college messages
**GET `/api/chat/coaching/:coachingId`** - Get coaching messages

**Socket Events:**
- `join-school-chat`
- `join-college-chat`
- `join-coaching-chat`
- `send-school-message`
- `send-college-message`
- `send-coaching-message`

## User Interface

### Chat Page Updates

**Tab Navigation:**
- Global Chat (all students)
- Organization Chat (school/college/coaching)

**Organization Chat:**
- Only visible if user has organization
- Shows organization name
- Member count
- Organization-specific messages

### Settings Page

**Sound Controls:**
- Enable/disable all sounds
- Individual sound toggles
- Test sound buttons

**Organization:**
- Current organization display
- Change organization option
- Leave organization

## Implementation Details

### Persistent Login

**Session Management:**
```typescript
// Express session with long expiry
session({
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
})
```

**Last Active Tracking:**
- Updated on each API call
- Used for "online" status
- Cleanup inactive sessions

### Sound System

**Sound Manager:**
```typescript
class SoundManager {
  playMessageNotification()  // Two-tone
  playNotification()          // Ascending
  playToggle(isDark)          // Theme switch
  playClick()                 // Button click
  setEnabled(enabled)         // Toggle sounds
  isEnabled()                 // Check status
}
```

**Usage:**
```typescript
import { soundManager } from '@/lib/sounds';

// Play on new message
soundManager.playMessageNotification();

// Play on notification
soundManager.playNotification();
```

### Organization Search

**Auto-complete:**
- Debounced search (300ms)
- Fuzzy matching
- City/state filtering
- Recent organizations first

**Create Flow:**
1. Search for organization
2. If not found, show "Create new"
3. Fill organization details
4. Submit and auto-join

## Socket.io Updates

### Room Management

**Global Room:** `global-chat`
**School Room:** `school-{schoolId}`
**College Room:** `college-{collegeId}`
**Coaching Room:** `coaching-{coachingId}`

### Events

```typescript
// Join organization chat
socket.emit('join-school-chat', { schoolId, userId });

// Send message
socket.emit('send-school-message', { 
  schoolId, 
  message 
});

// Receive message
socket.on('new-school-message', (message) => {
  soundManager.playMessageNotification();
});
```

## Benefits

### For Students:
- ✅ Connect with peers from same institution
- ✅ Organization-specific discussions
- ✅ Find study partners nearby
- ✅ Share local resources
- ✅ Persistent login (no repeated sign-ins)
- ✅ Audio notifications

### For Platform:
- ✅ Better user engagement
- ✅ Community building
- ✅ Local network effects
- ✅ Targeted features per organization
- ✅ Analytics per institution

## Privacy & Security

**Organization Data:**
- Public information only
- No sensitive data
- User can leave anytime
- Optional feature

**Chat Security:**
- Rate limiting per room
- Message validation
- Spam prevention
- Report/block features (future)

## Future Enhancements

- [ ] Organization admins
- [ ] Organization profiles
- [ ] Organization leaderboards
- [ ] Organization events
- [ ] Private messaging
- [ ] File sharing
- [ ] Voice/video chat
- [ ] Organization verification
- [ ] Alumni networks

---

Building communities within StudyBuddy! 🏫💬
