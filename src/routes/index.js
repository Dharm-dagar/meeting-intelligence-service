const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const authController = require('../controllers/authController');
const meetingController = require('../controllers/meetingController');
const actionItemController = require('../controllers/actionItemController');

// Auth routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Meeting routes (protected)
router.post('/meetings', authMiddleware, meetingController.createMeeting);
router.get('/meetings', authMiddleware, meetingController.listMeetings);
router.get('/meetings/:id', authMiddleware, meetingController.getMeeting);
router.post('/meetings/:id/analyze', authMiddleware, meetingController.analyzeMeeting);

// Action item routes (protected)
router.post('/action-items', authMiddleware, actionItemController.createActionItem);
router.get('/action-items', authMiddleware, actionItemController.listActionItems);
router.get('/action-items/overdue', authMiddleware, actionItemController.getOverdueActionItems);
router.patch('/action-items/:id/status', authMiddleware, actionItemController.updateStatus);

// Reminder routes (protected)
router.post('/reminders/trigger', authMiddleware, actionItemController.triggerReminders);
router.get('/reminders/history', authMiddleware, actionItemController.getReminderHistory);

module.exports = router;
