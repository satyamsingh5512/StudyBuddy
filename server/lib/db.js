"use strict";
/**
 * Database abstraction layer for MongoDB
 * Replaces Prisma with MongoDB native driver
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectId = exports.toObjectId = exports.generateId = exports.db = void 0;
const mongodb_1 = require("./mongodb");
Object.defineProperty(exports, "generateId", { enumerable: true, get: function () { return mongodb_1.generateId; } });
Object.defineProperty(exports, "toObjectId", { enumerable: true, get: function () { return mongodb_1.toObjectId; } });
Object.defineProperty(exports, "ObjectId", { enumerable: true, get: function () { return mongodb_1.ObjectId; } });
// Helper to create generic model wrappers
const createModel = (collectionName) => {
    return {
        async findUnique(params) {
            const mongoDb = await (0, mongodb_1.getMongoDb)();
            if (!mongoDb)
                throw new Error('Database not connected');
            const { where, select } = params;
            const filter = { ...where };
            // Map id to _id if present
            if (filter.id) {
                try {
                    filter._id = (0, mongodb_1.toObjectId)(filter.id);
                }
                catch (error) {
                    console.error('❌ Invalid ObjectId:', filter.id);
                    return null;
                }
                delete filter.id;
            }
            const options = {};
            if (select) {
                options.projection = {};
                for (const key in select) {
                    if (select[key])
                        options.projection[key] = 1;
                }
                if (options.projection.id) {
                    options.projection._id = 1;
                    delete options.projection.id;
                }
            }
            const doc = await mongoDb.collection(collectionName).findOne(filter, options);
            if (!doc)
                return null;
            return { ...doc, id: doc._id.toString() };
        },
        async findFirst(params) {
            // Handle params being just "where" or "{ where }"
            const actualParams = params.where ? params : { where: params };
            const mongoDb = await (0, mongodb_1.getMongoDb)();
            if (!mongoDb)
                throw new Error('Database not connected');
            const filter = { ...actualParams.where };
            if (filter.id) {
                filter._id = (0, mongodb_1.toObjectId)(filter.id);
                delete filter.id;
            }
            const options = {};
            if (actualParams.select) {
                options.projection = {};
                for (const key in actualParams.select) {
                    if (actualParams.select[key])
                        options.projection[key] = 1;
                }
                if (options.projection.id) {
                    options.projection._id = 1;
                    delete options.projection.id;
                }
            }
            // Handle sorting if needed (findFirst usually implies order)
            const sort = {};
            if (actualParams.orderBy) {
                for (const [key, value] of Object.entries(actualParams.orderBy)) {
                    sort[key] = value === 'asc' ? 1 : -1;
                }
            }
            const doc = await mongoDb.collection(collectionName).findOne(filter, { ...options, sort });
            if (!doc)
                return null;
            return { ...doc, id: doc._id.toString() };
        },
        async findMany(params) {
            const mongoDb = await (0, mongodb_1.getMongoDb)();
            if (!mongoDb)
                throw new Error('Database not connected');
            const filter = { ...params?.where };
            if (filter.id) {
                filter._id = (0, mongodb_1.toObjectId)(filter.id);
                delete filter.id;
            }
            let query = mongoDb.collection(collectionName).find(filter);
            if (params?.orderBy) {
                const sort = {};
                // Handle array of order bys
                const orders = Array.isArray(params.orderBy) ? params.orderBy : [params.orderBy];
                for (const order of orders) {
                    for (const [key, value] of Object.entries(order || {})) {
                        sort[key] = value === 'asc' ? 1 : -1;
                    }
                }
                query = query.sort(sort);
            }
            if (params?.skip)
                query = query.skip(params.skip);
            if (params?.take)
                query = query.limit(params.take);
            if (params?.select) {
                const projection = {};
                for (const key in params.select) {
                    if (params.select[key])
                        projection[key] = 1;
                }
                if (projection.id) {
                    projection._id = 1;
                    delete projection.id;
                }
                query = query.project(projection);
            }
            const docs = await query.toArray();
            return docs.map(d => ({ ...d, id: d._id.toString() }));
        },
        async create(params) {
            const mongoDb = await (0, mongodb_1.getMongoDb)();
            if (!mongoDb)
                throw new Error('Database not connected');
            const data = {
                ...params.data,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            // Clean up undefined
            Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
            const result = await mongoDb.collection(collectionName).insertOne(data);
            return { ...data, id: result.insertedId.toString(), _id: result.insertedId };
        },
        async update(params) {
            const mongoDb = await (0, mongodb_1.getMongoDb)();
            if (!mongoDb)
                throw new Error('Database not connected');
            const updateData = { ...params.data, updatedAt: new Date() };
            const result = await mongoDb.collection(collectionName).findOneAndUpdate({ _id: (0, mongodb_1.toObjectId)(params.where.id) }, { $set: updateData }, { returnDocument: 'after' });
            if (!result)
                throw new Error(`${collectionName} not found`);
            return { ...result, id: result._id.toString() };
        },
        async updateMany(params) {
            const mongoDb = await (0, mongodb_1.getMongoDb)();
            if (!mongoDb)
                throw new Error('Database not connected');
            const result = await mongoDb.collection(collectionName).updateMany(params.where, { $set: params.data });
            return { count: result.modifiedCount };
        },
        async delete(params) {
            const mongoDb = await (0, mongodb_1.getMongoDb)();
            if (!mongoDb)
                throw new Error('Database not connected');
            await mongoDb.collection(collectionName).deleteOne({ _id: (0, mongodb_1.toObjectId)(params.where.id) });
            return { id: params.where.id, success: true };
        },
        async deleteMany(params) {
            const mongoDb = await (0, mongodb_1.getMongoDb)();
            if (!mongoDb)
                throw new Error('Database not connected');
            const result = await mongoDb.collection(collectionName).deleteMany(params?.where || {});
            return { count: result.deletedCount };
        },
        async count(params) {
            const mongoDb = await (0, mongodb_1.getMongoDb)();
            if (!mongoDb)
                throw new Error('Database not connected');
            return await mongoDb.collection(collectionName).countDocuments(params?.where || {});
        }
    };
};
exports.db = {
    user: createModel('users'),
    session: createModel('sessions'),
    fAQ: createModel('faqs'),
    schedule: createModel('schedules'),
    timerSession: createModel('timer_sessions'),
    notice: createModel('notices'),
    dailyReport: createModel('daily_reports'),
    todo: createModel('todos'),
    friendship: createModel('friendships'),
    block: createModel('blocks'),
    directMessage: createModel('direct_messages'),
    chatMessage: createModel('chat_messages'),
};
