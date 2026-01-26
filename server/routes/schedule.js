"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const db_1 = require("../lib/db");
// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Get schedules for a specific date range
router.get('/', auth_1.isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;
        console.log('Fetching schedules for user:', userId);
        console.log('Date range:', { startDate, endDate });
        const where = { userId };
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.$gte = new Date(startDate);
            if (endDate)
                where.date.$lte = new Date(endDate);
        }
        const schedules = await db_1.db.schedule.findMany({
            where,
            orderBy: [
                { date: 'desc' },
                { startTime: 'asc' },
            ],
        });
        console.log('Found schedules:', schedules.length);
        res.json(schedules);
    }
    catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});
// Create a new schedule entry
router.post('/', auth_1.isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const { date, startTime, endTime, title, subject, notes } = req.body;
        console.log('Creating schedule for user:', userId);
        console.log('Schedule data:', { date, startTime, endTime, title, subject, notes });
        // Create the schedule entry immediately for better UX
        const schedule = await db_1.db.schedule.create({
            data: {
                userId,
                date: new Date(date),
                startTime,
                endTime,
                title: title || '',
                subject: subject || '',
                notes: notes || '',
            },
        });
        console.log('Schedule created successfully:', schedule.id);
        res.json(schedule);
    }
    catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});
// Update a schedule entry
router.put('/:id', auth_1.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { date, startTime, endTime, title, subject, notes, completed } = req.body;
        console.log('Updating schedule:', id, 'for user:', userId);
        const updateData = {};
        if (date)
            updateData.date = new Date(date);
        if (startTime)
            updateData.startTime = startTime;
        if (endTime)
            updateData.endTime = endTime;
        if (title !== undefined)
            updateData.title = title;
        if (subject !== undefined)
            updateData.subject = subject;
        if (notes !== undefined)
            updateData.notes = notes;
        if (completed !== undefined)
            updateData.completed = completed;
        const result = await db_1.db.schedule.updateMany({
            where: { id, userId },
            data: updateData,
        });
        if (result.count === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        console.log('Schedule updated successfully');
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ error: 'Failed to update schedule' });
    }
});
// Delete a schedule entry
router.delete('/:id', auth_1.isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const schedule = await db_1.db.schedule.deleteMany({
            where: { id, userId },
        });
        if (schedule.count === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
});
exports.default = router;
