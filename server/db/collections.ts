import { getClient, getDb } from './client.js';
import {
    User,
    Todo,
    DailyReport,
    Friendship,
    DirectMessage,
    Block,
    FAQ,
    Schedule,
    TimerSession,
    Notice,
    Waitlist,
    RefreshToken
} from '../types/index.js';

export const collections = {
    get users() {
        return getClient().then(client => client.db().collection<User>('users'));
    },
    get todos() {
        return getClient().then(client => client.db().collection<Todo>('todos'));
    },
    get dailyReports() {
        return getClient().then(client => client.db().collection<DailyReport>('daily_reports'));
    },
    get friendships() {
        return getClient().then(client => client.db().collection<Friendship>('friendships'));
    },
    get directMessages() {
        return getClient().then(client => client.db().collection<DirectMessage>('direct_messages'));
    },
    get blocks() {
        return getClient().then(client => client.db().collection<Block>('blocks'));
    },
    get faqs() {
        return getClient().then(client => client.db().collection<FAQ>('faqs'));
    },
    get schedules() {
        return getClient().then(client => client.db().collection<Schedule>('schedules'));
    },
    get timerSessions() {
        return getClient().then(client => client.db().collection<TimerSession>('timer_sessions'));
    },
    get notices() {
        return getClient().then(client => client.db().collection<Notice>('notices'));
    },
    get waitlist() {
        return getClient().then(client => client.db().collection<Waitlist>('waitlist'));
    },
    get refreshTokens() {
        return getClient().then(client => client.db().collection<RefreshToken>('refresh_tokens'));
    }
};

export { getDb };
