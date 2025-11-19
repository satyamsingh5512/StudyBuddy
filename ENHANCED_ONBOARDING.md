# Enhanced Onboarding System

## Overview

The onboarding system now collects comprehensive exam preparation details and uses Gemini AI to automatically fetch exam dates and syllabus information.

## New Features

### 🎯 Three-Step Onboarding Process

**Step 1: Username & Avatar**
- Choose unique username
- Select avatar type (photo or animated)
- Choose from 6 animated styles

**Step 2: Exam Details** ⭐ NEW
- Select exam type (JEE, NEET, UPSC, CAT, GATE, Other)
- Choose current class/status
- Select academic batch
- Specify attempt number (for JEE/NEET)
- View exam-specific FAQs

**Step 3: Confirmation**
- Review all details
- AI fetches exam date and syllabus automatically
- Complete setup

### 📚 Exam Types Supported

1. **JEE (Joint Entrance Examination)**
   - Maximum 3 attempts allowed
   - Attempt tracking
   - Comprehensive syllabus

2. **NEET (National Eligibility cum Entrance Test)**
   - Maximum 2 attempts allowed
   - Attempt tracking
   - Medical syllabus

3. **UPSC (Union Public Service Commission)**
   - No attempt limit
   - Civil services preparation

4. **CAT (Common Admission Test)**
   - MBA entrance exam

5. **GATE (Graduate Aptitude Test in Engineering)**
   - Engineering postgraduate exam

6. **Other**
   - Custom exam preparation

### 🤖 AI-Powered Features

**Automatic Exam Date Fetching**
- Gemini AI fetches expected exam dates
- Based on exam type and batch
- Stored in user profile

**Syllabus Generation**
- Complete subject-wise syllabus
- Topic breakdown
- Weightage information
- Stored as JSON in database

**Example Syllabus Structure**:
```json
{
  "subjects": [
    {
      "name": "Physics",
      "topics": [
        "Mechanics",
        "Thermodynamics",
        "Electromagnetism"
      ],
      "weightage": "33%"
    }
  ]
}
```

### ❓ FAQ System

**Admin-Managed FAQs**
- Exam-specific frequently asked questions
- Managed through API
- Displayed during onboarding
- Helps students make informed decisions

**FAQ Structure**:
- Question
- Detailed answer
- Exam type association
- Display order
- Published status

## Database Schema Updates

### User Model

```prisma
model User {
  // ... existing fields
  examAttempt     Int?          // Current attempt (1-3 for JEE, 1-2 for NEET)
  studentClass    String?       // "11th", "12th", "Dropper", etc.
  batch           String?       // "2024-25", "2025-26", etc.
  syllabus        String?       // JSON string of syllabus
  examDate        DateTime?     // AI-fetched exam date
}
```

### FAQ Model

```prisma
model FAQ {
  id          String   @id
  examType    String   // "JEE", "NEET", etc.
  question    String
  answer      String
  order       Int      // Display order
  published   Boolean
  createdAt   DateTime
  updatedAt   DateTime
}
```

## API Endpoints

### POST `/api/users/onboarding`

Complete user onboarding with exam details.

**Request Body**:
```json
{
  "username": "study_master",
  "avatarType": "animated",
  "avatar": "https://...",
  "examGoal": "JEE",
  "studentClass": "12th",
  "batch": "2024-25",
  "examAttempt": 1
}
```

**Response**:
```json
{
  "id": "...",
  "username": "study_master",
  "examGoal": "JEE",
  "examDate": "2025-04-15T00:00:00.000Z",
  "syllabus": "{\"subjects\":[...]}",
  "examAttempt": 1,
  "onboardingDone": true
}
```

### POST `/api/ai/exam-info`

Fetch exam information using AI.

**Request Body**:
```json
{
  "examType": "JEE"
}
```

**Response**:
```json
{
  "examDate": "2025-04-15",
  "syllabus": {
    "subjects": [...]
  },
  "importantDates": [...]
}
```

### GET `/api/faqs/:examType`

Get FAQs for specific exam.

**Response**:
```json
[
  {
    "id": "...",
    "examType": "JEE",
    "question": "What is the exam pattern?",
    "answer": "JEE Main consists of...",
    "order": 1
  }
]
```

### FAQ Management (Admin)

**POST `/api/faqs`** - Create FAQ
**PATCH `/api/faqs/:id`** - Update FAQ
**DELETE `/api/faqs/:id`** - Delete FAQ

## User Flow

### New User Journey:

1. **Sign in with Google**
2. **Step 1**: Choose username and avatar
3. **Step 2**: Select exam details
   - Choose exam type
   - Select class and batch
   - Specify attempt (if applicable)
   - View FAQs (optional)
4. **AI Processing**: System fetches exam date and syllabus
5. **Step 3**: Review and complete
6. **Redirect to Dashboard** with personalized setup

### Attempt Limits:

**JEE**: Maximum 3 attempts
- Attempt 1, 2, or 3
- Tracked in database
- Displayed in profile

**NEET**: Maximum 2 attempts
- Attempt 1 or 2
- Tracked in database

**Other Exams**: No limit
- Attempt field not shown

## UI Components

### Step 2: Exam Details

**Exam Selection**:
- Dropdown with all exam types
- Clear descriptions

**Class Selection**:
- 11th
- 12th
- Dropper
- Graduate
- Working Professional

**Batch Selection**:
- 2024-25
- 2025-26
- 2026-27

**Attempt Selection** (conditional):
- Only shown for JEE/NEET
- Dropdown with allowed attempts
- Helper text showing maximum

**FAQ Dialog**:
- Button to view FAQs
- Modal with scrollable content
- Organized Q&A format

## AI Integration

### Gemini AI Prompts

**Exam Information**:
```
Provide comprehensive information about {examType} exam in JSON format:
{
  "examDate": "Expected exam date in YYYY-MM-DD format",
  "syllabus": {
    "subjects": [
      {
        "name": "Subject name",
        "topics": ["Topic 1", "Topic 2"],
        "weightage": "Percentage"
      }
    ]
  }
}
```

**Response Processing**:
- Extracts JSON from AI response
- Parses exam date
- Stores syllabus as JSON string
- Handles errors gracefully

### Fallback Behavior

If AI fetch fails:
- Onboarding still completes
- Exam date set to null
- Syllabus set to null
- User can update later in settings

## Admin Features

### FAQ Management

Admins can manage FAQs through API:

**Create FAQ**:
```bash
POST /api/faqs
{
  "examType": "JEE",
  "question": "What is the eligibility?",
  "answer": "Candidates must have...",
  "order": 1,
  "published": true
}
```

**Update FAQ**:
```bash
PATCH /api/faqs/:id
{
  "answer": "Updated answer..."
}
```

**Delete FAQ**:
```bash
DELETE /api/faqs/:id
```

## Benefits

### For Students:
- ✅ Personalized exam preparation
- ✅ Automatic syllabus tracking
- ✅ Exam date reminders
- ✅ Attempt tracking (JEE/NEET)
- ✅ Access to exam-specific FAQs
- ✅ Informed decision making

### For Platform:
- ✅ Better user segmentation
- ✅ Targeted content delivery
- ✅ Accurate analytics
- ✅ Improved recommendations
- ✅ Exam-specific features

## Future Enhancements

Potential additions:
- [ ] Study plan based on syllabus
- [ ] Progress tracking per topic
- [ ] Mock tests based on exam pattern
- [ ] Peer comparison within same exam/batch
- [ ] Exam-specific resources
- [ ] Countdown to exam date
- [ ] Syllabus completion percentage
- [ ] Topic-wise analytics

## Testing

### Test Scenarios:

1. **JEE Student**:
   - Select JEE
   - Choose 12th class
   - Select 2024-25 batch
   - Choose Attempt 1
   - Verify attempt limit (max 3)

2. **NEET Student**:
   - Select NEET
   - Choose Dropper
   - Select 2024-25 batch
   - Choose Attempt 2
   - Verify attempt limit (max 2)

3. **UPSC Student**:
   - Select UPSC
   - Choose Graduate
   - Select 2024-25 batch
   - Verify no attempt field

4. **FAQ Viewing**:
   - Select exam type
   - Click "View FAQs"
   - Verify modal opens
   - Check FAQ content

5. **AI Integration**:
   - Complete onboarding
   - Check database for exam date
   - Verify syllabus JSON

## Troubleshooting

### AI fetch fails:
- Check Gemini API key
- Verify API quota
- Check network connection
- Review server logs

### FAQs not loading:
- Verify exam type matches
- Check published status
- Ensure database connection

### Attempt validation:
- Verify exam type
- Check attempt number
- Ensure within limits

---

Comprehensive exam preparation starts with proper onboarding! 🎓✨
