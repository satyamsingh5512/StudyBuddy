# User Onboarding System

## Overview

New users are now guided through a personalized onboarding flow to set up their username and choose their avatar style.

## Features

### 🎯 Two-Step Onboarding

**Step 1: Username Selection**
- Choose a unique username
- Lowercase letters, numbers, and underscores only
- Maximum 20 characters
- Real-time validation
- Checks for availability

**Step 2: Avatar Selection**
- Choose between two options:
  1. **Profile Photo**: Use Google profile picture
  2. **Animated Avatar**: Choose from 6 fun styles

### 🎨 Animated Avatar Styles

Powered by [DiceBear](https://dicebear.com/):

1. **Adventurer** - Illustrated characters
2. **Avataaars** - Sketch-style avatars
3. **Bottts** - Robot avatars
4. **Lorelei** - Illustrated faces
5. **Micah** - Simple illustrated style
6. **Pixel Art** - Retro 8-bit style

Each style generates a unique avatar based on the username.

## User Flow

### For New Users:

1. **Sign in with Google**
2. **Redirected to Onboarding** (`/onboarding`)
3. **Step 1**: Enter username
4. **Step 2**: Choose avatar type
   - If animated: Select style
   - Preview updates in real-time
5. **Complete Setup**
6. **Redirected to Dashboard**

### For Returning Users:

- Skip onboarding
- Go directly to dashboard
- Username and avatar already set

## Database Schema

### User Model Updates

```prisma
model User {
  username        String?  @unique  // Unique username
  avatarType      String   @default("photo")  // "photo" or "animated"
  onboardingDone  Boolean  @default(false)    // Onboarding status
  // ... other fields
}
```

## API Endpoints

### POST `/api/users/onboarding`

Complete user onboarding.

**Request Body**:
```json
{
  "username": "study_master",
  "avatarType": "animated",
  "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=study_master"
}
```

**Response**:
```json
{
  "id": "...",
  "username": "study_master",
  "avatarType": "animated",
  "avatar": "https://...",
  "onboardingDone": true,
  // ... other user fields
}
```

**Error Responses**:
- `400`: Username already taken
- `500`: Server error

## Components

### Onboarding Component
**Location**: `src/pages/Onboarding.tsx`

**Features**:
- Two-step wizard interface
- Real-time username validation
- Avatar preview
- Responsive design
- Loading states
- Error handling

### Layout Updates
**Location**: `src/components/Layout.tsx`

**Changes**:
- Shows `@username` if set
- Falls back to full name
- Avatar displays chosen style

## Username Rules

### Allowed Characters:
- Lowercase letters (a-z)
- Numbers (0-9)
- Underscores (_)

### Restrictions:
- Must be unique
- 1-20 characters
- No spaces or special characters
- Automatically converted to lowercase

### Examples:
- ✅ `study_master`
- ✅ `jee_2024`
- ✅ `neet_aspirant_99`
- ❌ `Study Master` (spaces)
- ❌ `user@123` (special chars)
- ❌ `UPPERCASE` (converted to lowercase)

## Avatar Generation

### Photo Avatar:
- Uses Google profile picture
- Stored URL from OAuth

### Animated Avatar:
- Generated via DiceBear API
- URL format: `https://api.dicebear.com/7.x/{style}/svg?seed={username}`
- Deterministic (same username = same avatar)
- No storage needed (generated on-the-fly)
- SVG format (scalable, lightweight)

## UI/UX Details

### Step 1: Username
- Large input field
- Character counter
- Real-time validation
- Helper text
- Next button (disabled until valid)

### Step 2: Avatar
- Two large option cards
- Visual preview
- Grid of avatar styles (if animated)
- Live preview updates
- Back and Complete buttons

### Design:
- Centered card layout
- Clean, minimal design
- Smooth transitions
- Loading states
- Error messages via toast

## Security & Validation

### Username Validation:
- Client-side: Regex pattern
- Server-side: Database uniqueness check
- Sanitization: Remove invalid characters

### Avatar Validation:
- Type check: "photo" or "animated"
- URL validation for custom avatars
- Fallback to default if invalid

## Accessibility

- ✅ Keyboard navigation
- ✅ Screen reader labels
- ✅ Focus management
- ✅ Error announcements
- ✅ Clear instructions

## Performance

- **Avatar Loading**: SVG format (small size)
- **API Calls**: Single request on submit
- **Caching**: Browser caches avatar URLs
- **Validation**: Debounced username checks

## Future Enhancements

Potential additions:
- [ ] Username suggestions if taken
- [ ] More avatar styles
- [ ] Custom avatar upload
- [ ] Avatar customization (colors, accessories)
- [ ] Username change (with cooldown)
- [ ] Avatar gallery/history
- [ ] Social profile links

## Testing

### Manual Testing:
1. Sign in as new user
2. Verify onboarding appears
3. Try invalid usernames
4. Try taken username
5. Select different avatar styles
6. Complete onboarding
7. Verify redirect to dashboard
8. Check username displays correctly

### Edge Cases:
- Username already taken
- Network errors
- Invalid characters
- Empty username
- Browser back button
- Page refresh during onboarding

## Troubleshooting

### Onboarding doesn't appear:
- Check `onboardingDone` field in database
- Verify user is authenticated
- Check console for errors

### Username validation fails:
- Ensure regex pattern matches
- Check database connection
- Verify unique constraint

### Avatar doesn't load:
- Check DiceBear API status
- Verify URL format
- Check network tab for errors

### Can't complete onboarding:
- Check API endpoint
- Verify request body
- Check server logs

---

Welcome new users with a smooth onboarding experience! 🎉
