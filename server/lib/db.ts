/**
 * Database abstraction layer for MongoDB
 * Replaces Prisma with MongoDB native driver
 */

import { getMongoDb, generateId, toObjectId, ObjectId } from './mongodb';

export interface User {
  _id?: ObjectId;
  id?: string;
  email: string;
  name: string;
  username?: string;
  password?: string;
  googleId?: string;
  emailVerified: boolean;
  verificationOtp?: string;
  otpExpiry?: Date;
  resetToken?: string;
  resetTokenExpiry?: Date;
  avatar?: string;
  avatarType: string;
  onboardingDone: boolean;
  examGoal: string;
  examDate?: Date;
  examAttempt?: number;
  studentClass?: string;
  batch?: string;
  syllabus?: string;
  schoolId?: string;
  collegeId?: string;
  coachingId?: string;
  totalPoints: number;
  totalStudyMinutes: number;
  streak: number;
  lastActive: Date;
  showProfile: boolean;
  createdAt: Date;
}

export const db = {
  user: {
    async findUnique(where: { email?: string; id?: string; googleId?: string; resetToken?: string }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      let filter: any = {};
      if (where.email) filter.email = where.email;
      if (where.id) filter._id = toObjectId(where.id);
      if (where.googleId) filter.googleId = where.googleId;
      if (where.resetToken) filter.resetToken = where.resetToken;

      const user = await mongoDb.collection('users').findOne(filter);
      if (!user) return null;

      return { ...user, id: user._id.toString() } as User;
    },

    async findFirst(where: any) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      const user = await mongoDb.collection('users').findOne(where);
      if (!user) return null;

      return { ...user, id: user._id.toString() } as User;
    },

    async create(data: { data: Partial<User> }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      const userData = {
        ...data.data,
        emailVerified: data.data.emailVerified ?? false,
        avatarType: data.data.avatarType ?? 'photo',
        onboardingDone: data.data.onboardingDone ?? false,
        examGoal: data.data.examGoal ?? 'JEE',
        totalPoints: data.data.totalPoints ?? 0,
        totalStudyMinutes: data.data.totalStudyMinutes ?? 0,
        streak: data.data.streak ?? 0,
        lastActive: data.data.lastActive ?? new Date(),
        showProfile: data.data.showProfile ?? true,
        createdAt: data.data.createdAt ?? new Date(),
      };

      const result = await mongoDb.collection('users').insertOne(userData);
      return { ...userData, id: result.insertedId.toString(), _id: result.insertedId } as User;
    },

    async update(params: { where: { id: string }; data: Partial<User> }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      const result = await mongoDb.collection('users').findOneAndUpdate(
        { _id: toObjectId(params.where.id) },
        { $set: params.data },
        { returnDocument: 'after' }
      );

      if (!result) throw new Error('User not found');
      return { ...result, id: result._id.toString() } as User;
    },

    async findMany(params?: { where?: any; orderBy?: any; take?: number; skip?: number }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      let query = mongoDb.collection('users').find(params?.where || {});

      if (params?.orderBy) {
        const sort: any = {};
        for (const [key, value] of Object.entries(params.orderBy)) {
          sort[key] = value === 'asc' ? 1 : -1;
        }
        query = query.sort(sort);
      }

      if (params?.skip) query = query.skip(params.skip);
      if (params?.take) query = query.limit(params.take);

      const users = await query.toArray();
      return users.map(u => ({ ...u, id: u._id.toString() })) as User[];
    },
  },

  session: {
    async create(data: { data: { sid: string; data: string; expiresAt: Date } }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      await mongoDb.collection('sessions').insertOne(data.data);
      return data.data;
    },

    async findUnique(where: { sid: string }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      return await mongoDb.collection('sessions').findOne({ sid: where.sid });
    },

    async update(params: { where: { sid: string }; data: any }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      await mongoDb.collection('sessions').updateOne(
        { sid: params.where.sid },
        { $set: params.data }
      );
    },

    async delete(where: { sid: string }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      await mongoDb.collection('sessions').deleteOne({ sid: where.sid });
    },

    async deleteMany(where: { expiresAt: { lt: Date } }) {
      const mongoDb = await getMongoDb();
      if (!mongoDb) throw new Error('Database not connected');

      await mongoDb.collection('sessions').deleteMany({
        expiresAt: { $lt: where.expiresAt.lt }
      });
    },
  },
};

export { generateId, toObjectId, ObjectId };
