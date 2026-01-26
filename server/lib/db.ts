/**
 * Database abstraction layer for MongoDB
 * Replaces Prisma with MongoDB native driver
 */

import { getMongoDb, generateId, toObjectId, ObjectId } from './mongodb';

export interface User {
  _id?: ObjectId;
  id: string;
  email: string;
  name: string;
  username: string | null;
  password: string | null;
  googleId: string | null;
  emailVerified: boolean;
  verificationOtp: string | null;
  otpExpiry: Date | null;
  resetToken: string | null;
  resetTokenExpiry: Date | null;
  avatar: string | null;
  avatarType: string;
  onboardingDone: boolean;
  examGoal: string;
  examDate: Date | null;
  examAttempt: number | null;
  studentClass: string | null;
  batch: string | null;
  syllabus: string | null;
  totalPoints: number;
  totalStudyMinutes: number;
  streak: number;
  lastActive: Date;
  showProfile: boolean;
  createdAt: Date;
}

export interface FAQ {
  id?: string;
  _id?: ObjectId;
  question: string;
  answer: string;
  examType: string;
  published: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Block {
  id?: string;
  _id?: ObjectId;
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: Date;
}

export interface Friendship {
  id?: string;
  _id?: ObjectId;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: Date;
  updatedAt: Date;
}

export interface DirectMessage {
  id?: string;
  _id?: ObjectId;
  senderId: string;
  receiverId: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface Schedule {
  id?: string;
  _id?: ObjectId;
  userId: string;
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

export interface DailyReport {
  id?: string;
  _id?: ObjectId;
  userId: string;
  date: Date;
  studyHours: number;
  completionPct: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Todo {
  id?: string;
  _id?: ObjectId;
  userId: string;
  title: string;
  subject: string;
  difficulty: string;
  questionsTarget: number;
  questionsCompleted: number;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to create generic model wrappers
const createModel = <T extends { id?: string; _id?: ObjectId }>(collectionName: string) => {
  return {
    async findUnique(params: { where: any; select?: Record<string, boolean>; include?: any }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      const { where, select } = params;
      const filter: any = { ...where };

      // Map id to _id if present
      if (filter.id) {
        try {
          filter._id = toObjectId(filter.id);
        } catch (error) {
          console.error('❌ Invalid ObjectId:', filter.id);
          return null;
        }
        delete filter.id;
      }

      const options: any = {};
      if (select) {
        options.projection = {};
        for (const key in select) {
          if (select[key]) options.projection[key] = 1;
        }
        if (options.projection.id) {
          options.projection._id = 1;
          delete options.projection.id;
        }
      }

      const doc = await mongoDb.collection(collectionName).findOne(filter, options);
      if (!doc) return null;

      return { ...doc, id: doc._id.toString() } as T;
    },

    async findFirst(params: { where: any; orderBy?: any; select?: Record<string, boolean> }) {
      // Handle params being just "where" or "{ where }"
      const actualParams = params.where ? params : { where: params };

      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      const filter: any = { ...actualParams.where };
      if (filter.id) {
        filter._id = toObjectId(filter.id);
        delete filter.id;
      }

      const options: any = {};
      if (actualParams.select) {
        options.projection = {};
        for (const key in actualParams.select) {
          if (actualParams.select[key]) options.projection[key] = 1;
        }
        if (options.projection.id) {
          options.projection._id = 1;
          delete options.projection.id;
        }
      }

      // Handle sorting if needed (findFirst usually implies order)
      const sort: any = {};
      if (actualParams.orderBy) {
        for (const [key, value] of Object.entries(actualParams.orderBy)) {
          sort[key] = value === 'asc' ? 1 : -1;
        }
      }

      const doc = await mongoDb.collection(collectionName).findOne(filter, { ...options, sort });
      if (!doc) return null;

      return { ...doc, id: doc._id.toString() } as T;
    },

    async findMany(params?: { where?: any; orderBy?: any; take?: number; skip?: number; select?: Record<string, boolean>; include?: any }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      const filter: any = { ...params?.where };
      if (filter.id) {
        filter._id = toObjectId(filter.id);
        delete filter.id;
      }

      let query = mongoDb.collection(collectionName).find(filter);

      if (params?.orderBy) {
        const sort: any = {};
        // Handle array of order bys
        const orders = Array.isArray(params.orderBy) ? params.orderBy : [params.orderBy];
        for (const order of orders) {
          for (const [key, value] of Object.entries(order || {})) {
            sort[key] = value === 'asc' ? 1 : -1;
          }
        }
        query = query.sort(sort);
      }

      if (params?.skip) query = query.skip(params.skip);
      if (params?.take) query = query.limit(params.take);

      if (params?.select) {
        const projection: any = {};
        for (const key in params.select) {
          if (params.select[key]) projection[key] = 1;
        }
        if (projection.id) {
          projection._id = 1;
          delete projection.id;
        }
        query = query.project(projection);
      }

      const docs = await query.toArray();
      return docs.map(d => ({ ...d, id: d._id.toString() })) as T[];
    },

    async create(params: { data: any; include?: any }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      const data = {
        ...params.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Clean up undefined
      Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

      const result = await mongoDb.collection(collectionName).insertOne(data);
      return { ...data, id: result.insertedId.toString(), _id: result.insertedId } as T;
    },

    async update(params: { where: { id: string }; data: any }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      const updateData = { ...params.data, updatedAt: new Date() };

      const result = await mongoDb.collection(collectionName).findOneAndUpdate(
        { _id: toObjectId(params.where.id) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) throw new Error(`${collectionName} not found`);
      return { ...result, id: result._id.toString() } as T;
    },

    async updateMany(params: { where: any; data: any }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      const result = await mongoDb.collection(collectionName).updateMany(
        params.where,
        { $set: params.data }
      );
      return { count: result.modifiedCount };
    },

    async delete(params: { where: { id: string } }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      await mongoDb.collection(collectionName).deleteOne({ _id: toObjectId(params.where.id) });
      return { id: params.where.id, success: true };
    },

    async deleteMany(params?: { where: any }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      const result = await mongoDb.collection(collectionName).deleteMany(params?.where || {});
      return { count: result.deletedCount };
    },

    async count(params?: { where: any }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      return await mongoDb.collection(collectionName).countDocuments(params?.where || {});
    }
  };
};

export const db = {
  user: createModel<User>('users'),
  session: createModel('sessions'),
  fAQ: createModel<FAQ>('faqs'),
  schedule: createModel<Schedule>('schedules'),
  timerSession: createModel('timer_sessions'),
  notice: createModel('notices'),
  dailyReport: createModel<DailyReport>('daily_reports'),
  todo: createModel<Todo>('todos'),
  friendship: createModel<Friendship>('friendships'),
  block: createModel<Block>('blocks'),
  directMessage: createModel<DirectMessage>('direct_messages'),
  chatMessage: createModel('chat_messages'),
};

export { generateId, toObjectId, ObjectId };
