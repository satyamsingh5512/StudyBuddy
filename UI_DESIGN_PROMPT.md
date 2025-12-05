# UI Design Prompt for StudyBuddy Application

Use this prompt with AI code agents (Cursor, v0, Claude, etc.) to replicate the StudyBuddy UI design.

---

## Overview

Create a modern, professional study management application with a clean, minimalist design that supports both light and dark modes with smooth transitions.

## Color Scheme & Theme

### Light Mode
```css
--background: 0 0% 100%;              /* Pure white */
--foreground: 240 10% 3.9%;           /* Near black */
--card: 0 0% 100%;                    /* White cards */
--card-foreground: 240 10% 3.9%;      /* Dark text */
--popover: 0 0% 100%;                 /* White popover */
--popover-foreground: 240 10% 3.9%;   /* Dark text */
--primary: 240 5.9% 10%;              /* Dark charcoal */
--primary-foreground: 0 0% 98%;       /* Off-white */
--secondary: 240 4.8% 95.9%;          /* Light gray */
--secondary-foreground: 240 5.9% 10%; /* Dark text */
--muted: 240 4.8% 95.9%;              /* Soft gray backgrounds */
--muted-foreground: 240 3.8% 46.1%;   /* Medium gray text */
--accent: 240 4.8% 95.9%;             /* Light accent */
--accent-foreground: 240 5.9% 10%;    /* Dark text */
--destructive: 0 84.2% 60.2%;         /* Red */
--destructive-foreground: 0 0% 98%;   /* White */
--border: 240 5.9% 90%;               /* Light borders */
--input: 240 5.9% 90%;                /* Input borders */
--ring: 240 5.9% 10%;                 /* Focus ring */
--radius: 0.5rem;                     /* Border radius */
```

### Dark Mode
```css
--background: 240 10% 3.9%;           /* Dark navy */
--foreground: 0 0% 98%;               /* Off-white */
--card: 240 10% 3.9%;                 /* Dark card */
--card-foreground: 0 0% 98%;          /* Light text */
--popover: 240 10% 3.9%;              /* Dark popover */
--popover-foreground: 0 0% 98%;       /* Light text */
--primary: 0 0% 98%;                  /* Off-white */
--primary-foreground: 240 5.9% 10%;   /* Dark text */
--secondary: 240 3.7% 15.9%;          /* Dark gray */
--secondary-foreground: 0 0% 98%;     /* Light text */
--muted: 240 3.7% 15.9%;              /* Medium dark */
--muted-foreground: 240 5% 64.9%;     /* Light gray text */
--accent: 240 3.7% 15.9%;             /* Dark accent */
--accent-foreground: 0 0% 98%;        /* Light text */
--destructive: 0 62.8% 30.6%;         /* Dark red */
--destructive-foreground: 0 0% 98%;   /* White */
--border: 240 3.7% 15.9%;             /* Dark borders */
--input: 240 3.7% 15.9%;              /* Dark input */
--ring: 240 4.9% 83.9%;               /* Light focus ring */
```

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### Heading Styles
- Letter spacing: `-0.02em`
- OpenType features: `"rlig" 1, "calt" 1, "ss01" 1`
- Clear hierarchy from h1 to h6

### Text Sizes
- h1: `text-3xl` (1.875rem)
- h2: `text-2xl` (1.5rem)
- h3: `text-xl` (1.25rem)
- Body: `text-base` (1rem)
- Small: `text-sm` (0.875rem)
- Extra small: `text-xs` (0.75rem)

## Layout & Spacing

### Border Radius
- Large: `var(--radius)` (0.5rem)
- Medium: `calc(var(--radius) - 2px)`
- Small: `calc(var(--radius) - 4px)`

### Spacing Scale
Use Tailwind's default spacing: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24

### Grid System
- Mobile: Single column
- Tablet: 2 columns
- Desktop: Sidebar + main content

## UI Components

### 1. Navigation

**Desktop Sidebar:**
- Fixed left sidebar (width: 16rem)
- Logo at top
- Navigation items with icons and labels
- Active state: Primary background + white text
- Hover: Accent background
- User profile dropdown at bottom

**Mobile Bottom Navigation:**
- Fixed bottom bar
- Icon-only navigation (5 main items)
- Active indicator (primary color)

**Navigation Items:**
```javascript
[
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/schedule', icon: Calendar, label: 'Schedule' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { path: '/notices', icon: Bell, label: 'Notices' },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]
```

### 2. Cards

```jsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

**Styling:**
- Background: `hsl(var(--card))`
- Border: `1px solid hsl(var(--border))`
- Border radius: `var(--radius)`
- Padding: `p-6` (1.5rem)

### 3. Buttons

**Variants:**
- **Default:** Primary background, white text
- **Secondary:** Light gray background
- **Outline:** Transparent with border
- **Ghost:** Transparent, hover shows background
- **Destructive:** Red variants

**Sizes:**
- Small: `h-9 px-3 text-xs`
- Default: `h-10 px-4 py-2`
- Large: `h-11 px-8`
- Icon: `h-10 w-10`

### 4. Form Inputs

**Input Fields:**
- Height: `h-10`
- Padding: `px-3 py-2`
- Border: `border border-input`
- Focus: Ring effect in primary color
- Rounded: `rounded-md`

**Checkboxes:**
- Size: `h-4 w-4`
- Smooth check animation
- Primary color when checked

### 5. Interactive Elements

**Hover States:**
- Background color change
- Slight opacity increase
- Smooth 200ms transition

**Focus States:**
- Ring effect: `ring-2 ring-ring ring-offset-2`
- Clear visual indicator

**Loading States:**
- Spinner icon animation
- Disabled state with reduced opacity

## Animations & Transitions

### Global Transitions
```css
transition-property: color, background-color, border-color;
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
transition-duration: 200ms;
```

### Page Transitions
```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Duration: 300ms */
```

### Loading Shimmer
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### Accordion Animations
- Down: Height expands (200ms ease-out)
- Up: Height collapses (200ms ease-out)

## Key Features UI

### 1. Dashboard

**Study Timer Widget:**
- Prominent placement at top
- Large time display (text-4xl or larger)
- Start/Stop/Pause buttons
- Visual progress indicator
- Subject selection

**Task List:**
- Card-based layout
- Each task shows:
  - Checkbox (left aligned)
  - Title and description
  - Subject badge
  - Difficulty indicator (easy/medium/hard)
  - Questions target counter
  - Delete button (visible on hover)

**AI Generation:**
- Button with sparkles icon
- Input field for prompt
- Loading state with spinner
- Success toast notification

**Stats Display:**
- Days until exam (prominent)
- Tasks completed today
- Study time today
- Current streak

### 2. Weekly Schedule

**Grid Layout:**
- 8 columns (time + 7 days)
- 14 rows (8 AM - 10 PM)
- Sticky header (day names)
- Sticky left column (time labels)

**Time Slots:**
- Min height: 60px (mobile), 70px (desktop)
- Border: Light neutral color
- Hover: Accent background + plus icon
- Filled: Primary background (5% opacity)

**Interaction:**
- Click empty cell → Show input
- Click filled cell → Edit mode
- Hover filled cell → Show delete button
- Auto-save to localStorage
- Real-time updates

**Responsive:**
- Horizontal scroll on mobile
- Full grid on desktop
- Touch-friendly targets (min 44x44px)

### 3. Reports Page

**Charts:**
- Bar charts for daily progress
- Line charts for trends
- Pie charts for subject distribution
- Date range selector

**Export:**
- Download as CSV button
- Print-friendly view

### 4. Leaderboard

**List View:**
- Ranked users with avatars
- Points/hours displayed
- Current user highlighted
- Animated entry on scroll

### 5. Chat/Community

**Message List:**
- Alternating message bubbles
- Timestamp display
- User avatars
- Scroll to bottom button

### 6. Settings

**Sections:**
- Profile settings
- Notification preferences
- Theme toggle (light/dark)
- Data export/import

## Icons

**Library:** Lucide React

**Common Icons:**
- Plus, Trash2, Edit, Check, X
- Calendar, Clock, Bell, MessageSquare
- Trophy, Target, BarChart, FileText
- Settings, User, LogOut, ChevronDown
- Loader2 (for loading states)
- Sparkles (for AI features)

**Sizing:**
- Small: `h-4 w-4` (16px)
- Default: `h-5 w-5` (20px)
- Large: `h-6 w-6` (24px)

## Responsive Breakpoints

```javascript
sm: '640px'   // Mobile landscape
md: '768px'   // Tablet
lg: '1024px'  // Desktop
xl: '1280px'  // Large desktop
2xl: '1536px' // Extra large
```

### Mobile (< 768px)
- Bottom navigation
- Single column layout
- Collapsible sections
- Touch-optimized targets

### Tablet (768px - 1024px)
- Sidebar navigation (collapsible)
- 2-column grid where appropriate
- Optimized for portrait and landscape

### Desktop (> 1024px)
- Full sidebar navigation
- Multi-column layouts
- Hover interactions
- Keyboard shortcuts

## Accessibility

### Requirements
- ARIA labels on all interactive elements
- Keyboard navigation support (Tab, Enter, Escape)
- Focus indicators (ring effect)
- Color contrast ratio ≥ 4.5:1 for text
- Skip to main content link
- Screen reader announcements for dynamic content

### Focus Management
- Visible focus ring on all interactive elements
- Focus trap in modals/dialogs
- Logical tab order

## Visual Polish

### Micro-interactions
- Button press effect (slight scale)
- Checkbox check animation
- Toast slide-in from top-right
- Smooth color transitions on theme change

### Loading States
- Skeleton loaders for content
- Spinner for actions
- Progress bars for long operations
- Optimistic UI updates

### Empty States
- Friendly illustrations (optional)
- Clear call-to-action
- Helpful guidance text

### Error States
- Red destructive color
- Clear error messages
- Retry buttons where appropriate
- Validation feedback on forms

### Success States
- Green success color (can add to theme)
- Toast notifications
- Check mark animations
- Optional sound effects

## Sound Effects (Optional)

```javascript
soundManager.playClick()    // Button clicks
soundManager.playSuccess()  // Task completion
soundManager.playError()    // Error feedback
soundManager.playNotify()   // New notifications
```

## Implementation Stack

### Core Technologies
- **Framework:** React 18+ with TypeScript
- **Styling:** Tailwind CSS 3+
- **State Management:** Jotai (atomic state)
- **Routing:** React Router v6
- **UI Components:** Custom components with Radix UI primitives

### Component Libraries
- **Radix UI:** Accessible component primitives
- **Lucide React:** Icon library
- **Framer Motion:** Advanced animations (optional)

### Build Tools
- **Vite:** Fast build tool
- **TypeScript:** Type safety
- **ESLint + Prettier:** Code quality

## Best Practices

1. **Component Structure:**
   - Small, reusable components
   - Memoization for performance (React.memo, useMemo, useCallback)
   - Prop drilling avoided with atoms/context

2. **Performance:**
   - Code splitting with React.lazy
   - Image optimization
   - Debounced search/filter inputs
   - Virtual scrolling for long lists

3. **Code Quality:**
   - TypeScript for type safety
   - Consistent naming conventions
   - Component documentation
   - Unit tests for utilities

4. **User Experience:**
   - Loading states for all async operations
   - Error boundaries for graceful failures
   - Optimistic UI updates
   - Smooth transitions between states

---

## Example Component Structure

```tsx
// Example: Task Item Component
interface TaskProps {
  id: string;
  title: string;
  completed: boolean;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const TaskItem = memo(({ id, title, completed, subject, difficulty, onToggle, onDelete }: TaskProps) => (
  <div className="flex items-start gap-3 p-3 rounded-md border group hover:bg-accent/50 transition-colors">
    <Checkbox 
      checked={completed} 
      onCheckedChange={() => onToggle(id)}
      className="mt-0.5"
    />
    <div className="flex-1 min-w-0">
      <p className={`text-sm ${completed ? 'line-through text-muted-foreground' : ''}`}>
        {title}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <Badge variant="secondary" className="text-xs">{subject}</Badge>
        <Badge variant={difficulty === 'hard' ? 'destructive' : 'outline'} className="text-xs">
          {difficulty}
        </Badge>
      </div>
    </div>
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onDelete(id)}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>
));
```

---

Use this comprehensive guide to build a StudyBuddy application that is modern, accessible, performant, and delightful to use!
