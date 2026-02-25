import { ObjectId } from 'mongodb';

export interface User {
    _id?: ObjectId;
    email: string;       // Unique, indexed
    password?: string;   // Hashed with bcrypt
    googleId?: string;   // Google OAuth ID
    name: string;
    username: string;    // Unique, indexed
    avatar?: string;     // Profile picture URL
    avatarType?: string;
    role: 'user' | 'admin';
    examGoal?: string;    // Target exam (NEET, JEE, etc.)
    examDate?: Date;     // Target exam date
    examAttempt?: number;
    studentClass?: string;
    batch?: string;
    syllabus?: string;
    emailVerified: boolean; // Email verification status
    verificationOtp?: string;
    otpExpiry?: Date;
    resetToken?: string;
    resetTokenExpiry?: Date;
    onboardingDone?: boolean;
    totalPoints: number;      // Gamification points
    totalStudyMinutes: number;
    streak: number;      // Daily study streak
    refreshTokenHash?: string;
    createdAt: Date;
    updatedAt: Date;
    lastActive: Date;    // For activity tracking
    showProfile: boolean;
}

export interface Todo {
    _id?: ObjectId;
    userId: ObjectId;        // Reference to User, indexed
    title: string;
    subject: string;         // Physics, Chemistry, etc.
    difficulty: 'easy' | 'medium' | 'hard';
    questionsTarget: number;
    questionsCompleted: number;
    completed: boolean;      // Indexed for filtering
    scheduledDate: Date;
    rescheduledCount: number;
    originalScheduledDate?: Date;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

export interface DailyReport {
    _id?: ObjectId;
    userId: ObjectId;        // Reference to User, indexed
    date: Date;              // Indexed for date queries
    studyHours: number;
    hoursLogged?: number;
    pointsEarned?: number;
    completionPct?: number;
    completionStats?: any;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Friendship {
    _id?: ObjectId;
    requesterId?: ObjectId; // Alternative naming depending on routes
    recipientId?: ObjectId;
    senderId?: ObjectId;    // Legacy fallback
    receiverId?: ObjectId;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
    createdAt: Date;
    updatedAt: Date;
}

export interface DirectMessage {
    _id?: ObjectId;
    senderId: ObjectId;      // Reference to User, indexed
    receiverId: ObjectId;    // Reference to User, indexed
    recipientId?: ObjectId;
    content?: string;
    message?: string;
    fileUrl?: string;
    read: boolean;           // Read status
    createdAt: Date;         // Indexed for sorting
    updatedAt?: Date;
}

export interface FAQ {
    _id?: ObjectId;
    question: string;
    answer: string;
    examType: string;
    published: boolean;
    order: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface Schedule {
    _id?: ObjectId;
    userId: ObjectId;
    date: Date;
    startTime: string;
    endTime: string;
    title: string;
    subject?: string;
    notes?: string;
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface Block {
    _id?: ObjectId;
    blockerId: ObjectId;
    blockedId: ObjectId;
    reason?: string;
    createdAt: Date;
}

export interface TimerSession {
    _id?: ObjectId;
    userId: ObjectId;
    duration: number; // minutes
    createdAt: Date;
}

export interface Notice {
    _id?: ObjectId;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Waitlist {
    _id?: ObjectId;
    email: string;
    createdAt: Date;
}

export interface RefreshToken {
    _id?: ObjectId;
    userId: ObjectId;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
}

declare module 'express-session' {
    interface SessionData {
        userId: string;
        email: string;
        role: 'user' | 'admin';
    }
}
