# Buddy Chat - AI Study Assistant

## Overview
Buddy Chat is an AI-powered conversational assistant that helps students create study tasks, plan their schedule, and get study advice. It's accessible from any page via a floating chat widget.

## Features

### 🤖 Conversational AI
- Natural language understanding
- Context-aware responses based on user's exam goal and study history
- Friendly and encouraging tone
- Powered by Groq AI (with Gemini fallback)

### ✅ Task Generation
- Generate study tasks through conversation
- AI suggests tasks with:
  - Title (specific and actionable)
  - Subject (Physics, Chemistry, Math, etc.)
  - Difficulty (easy, medium, hard)
  - Questions target (5-50 questions)
- One-click add to task list with + button

### 💬 Chat Interface
- Minimized floating button (bottom-right corner)
- Expandable chat window (420px × 600px)
- Minimize/maximize functionality
- Smooth animations and transitions
- Dark mode support
- Mobile responsive

## Usage

### Opening Buddy Chat
1. Look for the floating purple button in the bottom-right corner
2. Click to open the chat window
3. Green pulse indicator shows Buddy is online

### Creating Tasks
Ask Buddy to create tasks using natural language:

**Examples:**
```
"Create 5 physics tasks for thermodynamics"
"Generate chemistry tasks for organic reactions"
"Make 3 hard math problems on calculus"
"Give me some biology tasks for cell division"
"Plan tomorrow's study tasks"
```

### Adding Tasks
1. Buddy will suggest tasks in the chat
2. Each task shows:
   - Title
   - Subject badge
   - Difficulty badge
   - Questions count
3. Click the **+** button to add task to your list
4. Toast notification confirms task added

### General Conversation
Ask Buddy for:
- Study advice
- Topic suggestions
- Schedule planning
- Motivation
- Exam tips

**Examples:**
```
"How should I prepare for JEE?"
"What topics should I focus on?"
"I'm feeling unmotivated"
"How many hours should I study?"
```

## UI Components

### Floating Button
- **Location:** Bottom-right corner
- **Size:** 56px × 56px
- **Color:** Gradient purple/indigo
- **Indicator:** Green pulse dot (online status)
- **Hover:** Shows "Chat with Buddy" tooltip

### Chat Window
- **Size:** 420px × 600px (desktop), 96vw × 600px (mobile)
- **Position:** Fixed bottom-right
- **Sections:**
  - Header (with minimize/close buttons)
  - Messages area (scrollable)
  - Input area (with send button)

### Message Bubbles
- **User messages:** Right-aligned, indigo background
- **Buddy messages:** Left-aligned, white/gray background
- **Task cards:** Embedded in Buddy's messages
- **Timestamps:** Small text below each message

### Task Cards
- **Layout:** Compact card with task details
- **Badges:** Color-coded subject and difficulty
- **Action:** + button to add task
- **Hover:** Slight elevation effect

## Technical Details

### Frontend Component
**File:** `src/components/BuddyChat.tsx`

**State Management:**
- `isOpen` - Chat window visibility
- `isMinimized` - Minimized state
- `messages` - Chat history
- `input` - Current user input
- `isLoading` - AI response loading state

**Key Functions:**
- `handleSend()` - Send message to AI
- `handleAddTask()` - Add task to user's list
- `scrollToBottom()` - Auto-scroll to latest message

### Backend Endpoint
**Route:** `POST /api/ai/buddy-chat`

**Request:**
```json
{
  "message": "Create 5 physics tasks",
  "examGoal": "JEE"
}
```

**Response:**
```json
{
  "response": "Great! I'll create some physics tasks for you.",
  "tasks": [
    {
      "title": "Solve projectile motion problems",
      "subject": "Physics",
      "difficulty": "medium",
      "questionsTarget": 20
    }
  ],
  "provider": "groq"
}
```

### AI Processing
1. **Context Gathering:**
   - User's exam goal
   - Days until exam
   - Recent study topics
   - Study history

2. **Intent Detection:**
   - Task creation request
   - General conversation
   - Study advice

3. **Response Generation:**
   - Groq AI (primary): Llama 3.3 70B
   - Gemini (fallback): Gemini 1.5 Flash
   - Temperature: 0.7 (tasks), 0.8 (conversation)

4. **Task Extraction:**
   - Parse JSON from AI response
   - Validate task structure
   - Return tasks separately

## Rate Limiting

Buddy Chat uses the AI rate limiter:
- **Limit:** 10 requests per minute
- **Scope:** Per user + IP
- **Headers:** X-RateLimit-* headers in response

## Keyboard Shortcuts

- **Enter:** Send message
- **Shift+Enter:** New line in input
- **Escape:** Close chat (future enhancement)

## Styling

### Colors
- **Primary:** Indigo 600 (#4F46E5)
- **Secondary:** Purple 600 (#9333EA)
- **Success:** Green 500 (#10B981)
- **Background:** White / Gray 800 (dark mode)

### Animations
- **Open/Close:** Scale and fade
- **Minimize:** Height transition
- **Messages:** Slide in from bottom
- **Loading:** Spinner animation
- **Pulse:** Green dot animation

## Accessibility

- **ARIA Labels:** All buttons have descriptive labels
- **Keyboard Navigation:** Full keyboard support
- **Screen Readers:** Semantic HTML structure
- **Focus Management:** Proper focus handling
- **Color Contrast:** WCAG AA compliant

## Mobile Optimization

- **Responsive Width:** 96vw on mobile
- **Touch Targets:** Minimum 44px × 44px
- **Scroll Behavior:** Smooth scrolling
- **Input:** Auto-resize textarea
- **Position:** Fixed positioning works on mobile

## Error Handling

### Network Errors
- Toast notification with error message
- Retry option available
- Graceful degradation

### AI Errors
- Fallback to Gemini if Groq fails
- User-friendly error messages
- Maintains chat history

### Rate Limiting
- Shows rate limit error
- Displays retry time
- Prevents spam

## Best Practices

### For Users
1. Be specific in task requests
2. Mention subject and difficulty
3. Use natural language
4. Review tasks before adding
5. Ask follow-up questions

### For Developers
1. Keep messages in state
2. Scroll to bottom on new messages
3. Handle loading states
4. Validate AI responses
5. Test error scenarios

## Future Enhancements

- [ ] Chat history persistence
- [ ] Multi-turn conversations with context
- [ ] Voice input support
- [ ] Task editing before adding
- [ ] Bulk task operations
- [ ] Export chat history
- [ ] Custom Buddy personality
- [ ] Integration with calendar
- [ ] Study reminders
- [ ] Progress tracking

## Examples

### Task Creation
```
User: "Create 5 chemistry tasks for organic chemistry"

Buddy: "Great! I'll create some organic chemistry tasks for you."

[Shows 5 task cards with + buttons]
- Identify functional groups in organic compounds (Medium, 15 Qs)
- Practice IUPAC naming conventions (Easy, 20 Qs)
- Solve reaction mechanism problems (Hard, 10 Qs)
- ...
```

### Study Advice
```
User: "How should I prepare for JEE in 30 days?"

Buddy: "With 30 days left, focus on revision and practice. Prioritize your weak areas, solve previous year papers, and maintain a consistent schedule. You've got this! 💪"
```

### Motivation
```
User: "I'm feeling overwhelmed"

Buddy: "It's okay to feel that way! Break your study into smaller chunks, take regular breaks, and remember why you started. Every small step counts. I'm here to help! 🌟"
```

## Troubleshooting

### Chat not opening
- Check if component is imported in Layout
- Verify user is authenticated
- Check browser console for errors

### AI not responding
- Verify GROQ_API_KEY is set
- Check rate limit headers
- Review server logs
- Test with Gemini fallback

### Tasks not adding
- Check authentication
- Verify /api/todos endpoint
- Check network tab for errors
- Review toast notifications

### Styling issues
- Clear browser cache
- Check dark mode toggle
- Verify Tailwind classes
- Test on different screen sizes

## Performance

### Optimization
- Lazy loading of messages
- Debounced input
- Memoized components
- Efficient re-renders
- Minimal API calls

### Metrics
- **Load Time:** < 100ms
- **Response Time:** 1-3 seconds (AI)
- **Animation:** 60fps
- **Bundle Size:** ~15KB (gzipped)

---

**Version:** 1.0.0
**Last Updated:** January 19, 2026
**Status:** ✅ Production Ready
