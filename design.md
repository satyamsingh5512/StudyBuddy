# StudyBuddy - Design Document

## System Architecture Overview

StudyBuddy follows a modern full-stack architecture with serverless deployment, designed for scalability, performance, and maintainability.

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   API Gateway   │    │   External APIs │
│                 │    │                 │    │                 │
│ • Web (React)   │◄──►│ • Vercel Edge   │◄──►│ • Groq AI       │
│ • Mobile (Cap.) │    │ • Rate Limiting │    │ • Google Gemini │
│ • PWA           │    │ • CORS          │    │ • Google OAuth  │
└─────────────────┘    └─────────────────┘    │ • Resend Email  │
                                              └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Backend API    │
                    │                 │
                    │ • Express.js    │
                    │ • TypeScript    │
                    │ • Serverless    │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │    Database     │
                    │                 │
                    │ • MongoDB Atlas │
                    │ • Connection    │
                    │   Pooling       │
                    └─────────────────┘
```

## Technology Stack

### Frontend Architecture

#### Core Technologies
- **React 18**: Component-based UI with hooks and concurrent features
- **TypeScript**: Type safety and enhanced developer experience
- **Vite**: Fast build tool with HMR and optimized bundling
- **Tailwind CSS**: Utility-first styling with custom design system

#### State Management
- **Jotai**: Atomic state management for granular reactivity
- **React Query**: Server state management with caching and synchronization
- **Local Storage**: Persistent client-side data storage

#### UI Components & Libraries
- **Radix UI**: Accessible, unstyled component primitives
- **Framer Motion**: Smooth animations and transitions
- **Lucide React**: Consistent icon system
- **React Router**: Client-side routing with lazy loading

### Backend Architecture

#### Core Framework
- **Node.js**: JavaScript runtime with ES modules
- **Express.js**: Web framework with middleware architecture
- **TypeScript**: Type-safe server-side development
- **tsx**: TypeScript execution for development

#### Authentication & Security
- **Passport.js**: Authentication middleware with strategies
- **Google OAuth 2.0**: Social login integration
- **bcryptjs**: Password hashing with salt rounds
- **express-session**: Session management with MongoDB store
- **CORS**: Cross-origin resource sharing configuration

#### Database Layer
- **MongoDB**: Document-based NoSQL database
- **Native Driver**: Direct MongoDB operations for performance
- **Connection Pooling**: Efficient connection management
- **Indexing Strategy**: Optimized queries with compound indexes

### Deployment & Infrastructure

#### Hosting Platform
- **Vercel**: Serverless deployment with edge functions
- **Edge Runtime**: Global distribution for low latency
- **Automatic Scaling**: Serverless functions scale on demand
- **Environment Variables**: Secure configuration management

#### Mobile Deployment
- **Capacitor**: Native mobile app wrapper
- **PWA**: Progressive Web App capabilities
- **App Store**: iOS and Android distribution

## Database Design

### Data Models

#### User Schema
```typescript
interface User {
  _id: ObjectId;
  email: string;           // Unique, indexed
  password?: string;       // Hashed with bcrypt
  googleId?: string;       // Google OAuth ID
  name: string;
  username: string;        // Unique, indexed
  avatar?: string;         // Profile picture URL
  examGoal: string;        // Target exam (NEET, JEE, etc.)
  examDate?: Date;         // Target exam date
  emailVerified: boolean;  // Email verification status
  isAdmin: boolean;        // Admin privileges
  points: number;          // Gamification points
  streak: number;          // Daily study streak
  createdAt: Date;
  updatedAt: Date;
  lastActive: Date;        // For activity tracking
}
```

#### Todo Schema
```typescript
interface Todo {
  _id: ObjectId;
  userId: ObjectId;        // Reference to User, indexed
  title: string;
  subject: string;         // Physics, Chemistry, etc.
  difficulty: 'easy' | 'medium' | 'hard';
  questionsTarget: number;
  questionsCompleted: number;
  completed: boolean;      // Indexed for filtering
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

#### Daily Report Schema
```typescript
interface DailyReport {
  _id: ObjectId;
  userId: ObjectId;        // Reference to User, indexed
  date: Date;              // Indexed for date queries
  studyHours: number;
  tasksCompleted: number;
  tasksCreated: number;
  completionPct: number;
  subjects: string[];      // Subjects studied
  points: number;          // Points earned
  streak: number;          // Current streak
}
```

#### Friend Schema
```typescript
interface Friend {
  _id: ObjectId;
  userId: ObjectId;        // Requester, indexed
  friendId: ObjectId;      // Recipient, indexed
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: Date;
  acceptedAt?: Date;
}
```

#### Message Schema
```typescript
interface Message {
  _id: ObjectId;
  senderId: ObjectId;      // Reference to User, indexed
  receiverId: ObjectId;    // Reference to User, indexed
  content: string;
  type: 'text' | 'file';
  fileUrl?: string;
  read: boolean;           // Read status
  createdAt: Date;         // Indexed for sorting
}
```

### Database Indexing Strategy

#### Primary Indexes
```javascript
// Users collection
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ googleId: 1 }, { sparse: true });
db.users.createIndex({ lastActive: 1 });

// Todos collection
db.todos.createIndex({ userId: 1, createdAt: -1 });
db.todos.createIndex({ userId: 1, completed: 1 });
db.todos.createIndex({ userId: 1, subject: 1 });

// Daily Reports collection
db.dailyReports.createIndex({ userId: 1, date: -1 });
db.dailyReports.createIndex({ date: 1 });

// Friends collection
db.friends.createIndex({ userId: 1, status: 1 });
db.friends.createIndex({ friendId: 1, status: 1 });

// Messages collection
db.messages.createIndex({ senderId: 1, receiverId: 1, createdAt: -1 });
db.messages.createIndex({ receiverId: 1, read: 1 });
```

## API Design

### RESTful Endpoints

#### Authentication Routes
```
POST   /api/auth/register          # User registration
POST   /api/auth/login             # Email/password login
GET    /api/auth/google            # Google OAuth initiation
GET    /api/auth/google/callback   # Google OAuth callback
POST   /api/auth/logout            # User logout
POST   /api/auth/forgot-password   # Password reset request
POST   /api/auth/reset-password    # Password reset confirmation
GET    /api/auth/me               # Current user info
POST   /api/auth/verify-email     # Email verification
```

#### User Management
```
GET    /api/users/profile         # Get user profile
PUT    /api/users/profile         # Update user profile
POST   /api/users/avatar          # Upload profile picture
GET    /api/users/leaderboard     # Global leaderboard
GET    /api/users/search          # Search users
```

#### Task Management
```
GET    /api/todos                 # Get user tasks
POST   /api/todos                 # Create new task
PUT    /api/todos/:id             # Update task
DELETE /api/todos/:id             # Delete task
POST   /api/todos/:id/complete    # Mark task complete
GET    /api/todos/stats           # Task statistics
```

#### AI Integration
```
POST   /api/ai/buddy-chat         # Chat with AI assistant
POST   /api/ai/generate-tasks     # AI task generation
POST   /api/ai/study-plan         # AI study plan
POST   /api/ai/exam-date          # Get exam dates
```

#### Social Features
```
GET    /api/friends               # Get friends list
POST   /api/friends/request       # Send friend request
PUT    /api/friends/:id/accept    # Accept friend request
DELETE /api/friends/:id           # Remove friend
GET    /api/messages              # Get messages
POST   /api/messages              # Send message
```

### API Response Format

#### Success Response
```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}
```

#### Error Response
```typescript
interface ApiError {
  success: false;
  error: string;
  details?: string;
  code?: string;
  statusCode: number;
}
```

## Security Architecture

### Authentication Flow

```
1. User Registration/Login
   ├── Email/Password → bcrypt hashing
   ├── Google OAuth → JWT verification
   └── Session Creation → MongoDB store

2. Request Authentication
   ├── Session Cookie → Express session
   ├── User Lookup → Database query
   └── Authorization → Role-based access

3. API Protection
   ├── Rate Limiting → IP-based throttling
   ├── Input Validation → Schema validation
   └── CORS → Origin verification
```

### Security Measures

#### Input Validation
- **Schema Validation**: TypeScript interfaces with runtime validation
- **Sanitization**: HTML and SQL injection prevention
- **Rate Limiting**: Per-IP and per-user request throttling
- **File Upload**: Type and size restrictions

#### Data Protection
- **Password Hashing**: bcrypt with salt rounds (12)
- **Session Security**: httpOnly, secure, sameSite cookies
- **Environment Variables**: Secure API key storage
- **HTTPS Enforcement**: SSL/TLS encryption

#### Access Control
- **Authentication Middleware**: Route-level protection
- **Role-Based Access**: Admin vs. regular user permissions
- **Resource Ownership**: User can only access own data
- **API Key Protection**: Server-side AI API calls only

## Performance Optimization

### Frontend Optimization

#### Code Splitting
```typescript
// Route-based code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// Component-based splitting
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
```

#### Caching Strategy
- **React Query**: Server state caching with stale-while-revalidate
- **Browser Cache**: Static assets with long-term caching
- **Service Worker**: Offline functionality and cache management

#### Bundle Optimization
- **Tree Shaking**: Unused code elimination
- **Asset Optimization**: Image compression and lazy loading
- **Vendor Splitting**: Separate chunks for libraries

### Backend Optimization

#### Database Performance
```typescript
// Connection pooling
const mongoOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Query optimization
const getUserTodos = async (userId: string) => {
  return db.collection('todos')
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
};
```

#### Caching Layer
```typescript
// In-memory caching for frequently accessed data
const cache = new Map();

const getCachedLeaderboard = async () => {
  const cacheKey = 'leaderboard';
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 300000) { // 5 min TTL
    return cached.data;
  }

  const data = await generateLeaderboard();
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
};
```

#### API Optimization
- **Response Compression**: gzip compression for API responses
- **Field Selection**: Return only required fields
- **Pagination**: Limit large dataset responses
- **Batch Operations**: Reduce database round trips

## User Experience Design

### Design System

#### Color Palette
```css
:root {
  /* Primary Colors */
  --primary: 220 70% 50%;      /* Blue */
  --primary-foreground: 0 0% 98%;

  /* Secondary Colors */
  --secondary: 220 14.3% 95.9%;
  --secondary-foreground: 220.9 39.3% 11%;

  /* Accent Colors */
  --accent: 220 14.3% 95.9%;
  --accent-foreground: 220.9 39.3% 11%;

  /* Status Colors */
  --success: 142 76% 36%;      /* Green */
  --warning: 38 92% 50%;       /* Orange */
  --error: 0 84% 60%;          /* Red */
}
```

#### Typography Scale
```css
/* Font Sizes */
.text-xs { font-size: 0.75rem; }    /* 12px */
.text-sm { font-size: 0.875rem; }   /* 14px */
.text-base { font-size: 1rem; }     /* 16px */
.text-lg { font-size: 1.125rem; }   /* 18px */
.text-xl { font-size: 1.25rem; }    /* 20px */
.text-2xl { font-size: 1.5rem; }    /* 24px */
.text-3xl { font-size: 1.875rem; }  /* 30px */
```

#### Spacing System
```css
/* Spacing Scale (Tailwind) */
.space-1 { margin: 0.25rem; }   /* 4px */
.space-2 { margin: 0.5rem; }    /* 8px */
.space-4 { margin: 1rem; }      /* 16px */
.space-6 { margin: 1.5rem; }    /* 24px */
.space-8 { margin: 2rem; }      /* 32px */
```

### Component Architecture

#### Atomic Design Structure
```
src/components/
├── ui/                    # Atomic components
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   └── dialog.tsx
├── forms/                 # Molecular components
│   ├── LoginForm.tsx
│   └── TaskForm.tsx
├── layout/                # Organism components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Layout.tsx
└── features/              # Feature-specific components
    ├── BuddyChat.tsx
    ├── StudyTimer.tsx
    └── AnalyticsDashboard.tsx
```

#### Component Patterns
```typescript
// Compound Component Pattern
const Card = {
  Root: CardRoot,
  Header: CardHeader,
  Content: CardContent,
  Footer: CardFooter,
};

// Render Props Pattern
const DataFetcher = ({ children, url }) => {
  const { data, loading, error } = useQuery(url);
  return children({ data, loading, error });
};

// Custom Hooks Pattern
const useAuth = () => {
  const [user, setUser] = useAtom(userAtom);
  const login = useCallback(async (credentials) => {
    // Login logic
  }, []);
  return { user, login, logout };
};
```

### Responsive Design

#### Breakpoint System
```css
/* Mobile First Approach */
.container {
  width: 100%;
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    max-width: 768px;
    margin: 0 auto;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
    padding: 2rem;
  }
}

/* Large Desktop */
@media (min-width: 1280px) {
  .container {
    max-width: 1280px;
  }
}
```

#### Mobile-First Components
```typescript
const ResponsiveLayout = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div className="flex flex-col lg:flex-row">
      {!isMobile && <Sidebar />}
      <main className="flex-1">
        <Header />
        <Content />
      </main>
      {isMobile && <MobileNavigation />}
    </div>
  );
};
```

## AI Integration Architecture

### Multi-Model Support

#### AI Provider Abstraction
```typescript
interface AIProvider {
  name: string;
  generateResponse(prompt: string, context: UserContext): Promise<string>;
  generateTasks(prompt: string, context: UserContext): Promise<Task[]>;
  isAvailable(): boolean;
}

class GroqProvider implements AIProvider {
  name = 'groq';

  async generateResponse(prompt: string, context: UserContext) {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: this.buildSystemPrompt(context) },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
    });

    return completion.choices[0]?.message?.content || '';
  }
}

class GeminiProvider implements AIProvider {
  name = 'gemini';

  async generateResponse(prompt: string, context: UserContext) {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(
      `${this.buildSystemPrompt(context)}\n\nUser: ${prompt}`
    );

    return result.response.text();
  }
}
```

#### Context-Aware Prompting
```typescript
interface UserContext {
  examGoal: string;
  daysUntilExam?: number;
  recentTopics: string[];
  completionRate: number;
  studyHours: number;
  weakAreas?: string[];
}

const buildSystemPrompt = (context: UserContext) => {
  return `You are Buddy, an AI study assistant for ${context.examGoal} preparation.

User Context:
- Days until exam: ${context.daysUntilExam || 'Not set'}
- Recent topics: ${context.recentTopics.join(', ') || 'None'}
- Completion rate: ${context.completionRate}%
- Average study hours: ${context.studyHours}/day

Provide personalized, encouraging, and actionable study advice.`;
};
```

### Error Handling & Fallbacks

#### Graceful Degradation
```typescript
const getAIResponse = async (message: string, model: string, context: UserContext) => {
  const providers = [
    model === 'groq' ? groqProvider : geminiProvider,
    model === 'groq' ? geminiProvider : groqProvider, // Fallback
  ];

  for (const provider of providers) {
    try {
      if (provider.isAvailable()) {
        return await provider.generateResponse(message, context);
      }
    } catch (error) {
      console.error(`${provider.name} failed:`, error);
      continue;
    }
  }

  // Final fallback
  return "I'm having trouble connecting to AI services. Please try again later.";
};
```

## Monitoring & Analytics

### Application Monitoring

#### Performance Metrics
```typescript
// Custom performance tracking
const trackPerformance = (operation: string, duration: number) => {
  console.log(`[PERF] ${operation}: ${duration}ms`);

  // Send to analytics service
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'timing_complete', {
      name: operation,
      value: duration,
    });
  }
};

// API response time tracking
const apiTimer = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    trackPerformance(`API_${req.method}_${req.path}`, duration);
  });

  next();
};
```

#### Error Tracking
```typescript
// Global error handler
const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    user: req.user?.id,
    timestamp: new Date().toISOString(),
  });

  // Send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Sentry, LogRocket, etc.
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message }),
  });
};
```

### User Analytics

#### Event Tracking
```typescript
// User action tracking
const trackUserAction = (action: string, properties?: Record<string, any>) => {
  const event = {
    action,
    properties,
    userId: getCurrentUser()?.id,
    timestamp: Date.now(),
    sessionId: getSessionId(),
  };

  // Send to analytics
  if (typeof window !== 'undefined') {
    window.gtag?.('event', action, properties);
  }
};

// Usage examples
trackUserAction('task_created', { subject: 'Physics', difficulty: 'medium' });
trackUserAction('study_session_completed', { duration: 1800, tasks: 5 });
trackUserAction('ai_chat_message', { model: 'groq', responseTime: 1200 });
```

## Deployment Architecture

### Vercel Serverless Deployment

#### Project Structure
```
project/
├── api/
│   └── index.ts           # Vercel serverless entry point
├── server/
│   ├── app.ts            # Express app configuration
│   ├── routes/           # API route handlers
│   ├── middleware/       # Custom middleware
│   └── lib/              # Utility libraries
├── src/
│   ├── components/       # React components
│   ├── pages/           # Route components
│   └── lib/             # Client utilities
├── public/              # Static assets
├── vercel.json          # Vercel configuration
└── package.json         # Dependencies and scripts
```

#### Vercel Configuration
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.ts",
      "use": "@vercel/node"
    },
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Environment Configuration

#### Development Environment
```bash
# Local development
npm run dev              # Start both client and server
npm run dev:client       # Vite dev server (port 5173)
npm run dev:server       # Express server (port 3001)
```

#### Production Environment
```bash
# Build process
npm run build           # TypeScript compilation + Vite build
npm run start          # Production server

# Vercel deployment
vercel --prod          # Deploy to production
vercel env add         # Add environment variables
```

### Mobile App Architecture

#### Capacitor Integration
```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.studybuddy.app',
  appName: 'StudyBuddy',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
```

#### Native Features
```typescript
// Push notifications
import { PushNotifications } from '@capacitor/push-notifications';

const setupPushNotifications = async () => {
  const permission = await PushNotifications.requestPermissions();

  if (permission.receive === 'granted') {
    await PushNotifications.register();
  }
};

// Local storage
import { Preferences } from '@capacitor/preferences';

const storeUserPreferences = async (preferences: UserPreferences) => {
  await Preferences.set({
    key: 'userPreferences',
    value: JSON.stringify(preferences)
  });
};
```

## Testing Strategy

### Frontend Testing

#### Unit Testing
```typescript
// Component testing with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { BuddyChat } from './BuddyChat';

describe('BuddyChat', () => {
  it('should send message when form is submitted', async () => {
    render(<BuddyChat />);

    const input = screen.getByPlaceholderText('Message Buddy...');
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: 'Hello Buddy' } });
    fireEvent.click(sendButton);

    expect(screen.getByText('Hello Buddy')).toBeInTheDocument();
  });
});
```

#### Integration Testing
```typescript
// API integration testing
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.post('/api/ai/buddy-chat', (req, res, ctx) => {
    return res(ctx.json({ response: 'Hello! How can I help you study?' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Backend Testing

#### API Testing
```typescript
// Express route testing with Supertest
import request from 'supertest';
import app from '../server/app';

describe('POST /api/todos', () => {
  it('should create a new todo', async () => {
    const todoData = {
      title: 'Study Physics',
      subject: 'Physics',
      difficulty: 'medium',
      questionsTarget: 20
    };

    const response = await request(app)
      .post('/api/todos')
      .send(todoData)
      .expect(201);

    expect(response.body.data.title).toBe('Study Physics');
  });
});
```

#### Database Testing
```typescript
// MongoDB testing with in-memory database
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

let mongod: MongoMemoryServer;
let client: MongoClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  client = new MongoClient(uri);
  await client.connect();
});

afterAll(async () => {
  await client.close();
  await mongod.stop();
});
```

## Maintenance & Operations

### Code Quality

#### Linting & Formatting
```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "no-unused-vars": "error",
    "no-console": "warn",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}

// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

#### Git Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### Documentation

#### API Documentation
```typescript
/**
 * @swagger
 * /api/todos:
 *   post:
 *     summary: Create a new todo
 *     tags: [Todos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               subject:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *     responses:
 *       201:
 *         description: Todo created successfully
 */
```

#### Component Documentation
```typescript
/**
 * BuddyChat Component
 *
 * An AI-powered chat interface that provides study assistance and task generation.
 *
 * @example
 * ```tsx
 * <BuddyChat
 *   defaultModel="groq"
 *   onTaskGenerated={(tasks) => console.log(tasks)}
 * />
 * ```
 *
 * @param defaultModel - The default AI model to use ('groq' | 'gemini')
 * @param onTaskGenerated - Callback when AI generates tasks
 */
interface BuddyChatProps {
  defaultModel?: 'groq' | 'gemini';
  onTaskGenerated?: (tasks: Task[]) => void;
}
```

---

**Document Version**: 1.0
**Last Updated**: February 2026
**Architecture Review**: March 2026
