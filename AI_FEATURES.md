# AI Features & Timer Tracking

## New Features Added

### 1. AI Task Generation
- **Location**: Dashboard page
- **How to use**: 
  1. Type what you want to study (e.g., "Physics chapter 3 kinematics")
  2. Click "Generate Tasks with AI" button
  3. AI will create 3-5 specific study tasks automatically

**Example prompts**:
- "Organic chemistry reactions for NEET"
- "Calculus integration problems"
- "Modern physics for JEE Advanced"

### 2. Study Timer Tracking
- **Location**: Dashboard (Study Timer card)
- **Features**:
  - Click Play to start studying
  - Timer runs and tracks your study time
  - Click Pause to stop
  - **Automatically saves** your study session
  - Earns points: 1 point per 5 minutes studied

### 3. Enhanced Leaderboard
- **Location**: Leaderboard page
- **New display**:
  - Shows total study time for each user
  - Format: "Xh Ym studied"
  - Ranks by points (which include study time)

## Technical Details

### Database Changes
- Added `totalStudyMinutes` field to User model
- Tracks cumulative study time across all sessions

### API Endpoints

#### Generate Tasks with AI
```
POST /api/ai/generate-tasks
Body: { prompt: string, examGoal: string }
Response: { success: true, tasks: Todo[] }
```

#### Save Study Session
```
POST /api/timer/session
Body: { minutes: number }
Response: { success: true, user: User }
```

### Points System
- **Study time**: 1 point per 5 minutes
- **Task completion**: Points based on difficulty
- **Streak bonus**: Daily login streak

## Usage Tips

### For AI Task Generation
1. Be specific in your prompts
2. Mention the subject/topic
3. Can include difficulty level
4. AI understands your exam goal (JEE/NEET/etc.)

### For Study Timer
1. Start timer when you begin studying
2. Let it run during your session
3. Stop when done - points auto-saved
4. Timer resets for next session

## Future Enhancements
- Pomodoro break reminders
- Study analytics dashboard
- AI study plan recommendations
- Weekly study reports
