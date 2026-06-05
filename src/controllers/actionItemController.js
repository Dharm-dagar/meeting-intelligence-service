const { createActionItemSchema, updateStatusSchema, paginationSchema } = require('../utils/validation');
const actionItemService = require('../services/actionItemService');
const { sendReminderEmail } = require('../services/reminderService');
const { query } = require('../utils/database');
const { successResponse } = require('../utils/response');
const logger = require('../utils/logger');

async function createActionItem(req, res, next) {
  try {
    const data = createActionItemSchema.parse(req.body);
    const item = await actionItemService.createActionItem(req.user.userId, data);
    logger.info('Action item created', { traceId: req.traceId, itemId: item.id });
    return successResponse(res, item, 201);
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const item = await actionItemService.updateActionItemStatus(req.params.id, req.user.userId, status);
    logger.info('Action item status updated', { traceId: req.traceId, itemId: item.id, status });
    return successResponse(res, item);
  } catch (err) {
    next(err);
  }
}

async function listActionItems(req, res, next) {
  try {
    const pagination = paginationSchema.parse(req.query);
    const filters = {
      ...pagination,
      status: req.query.status,
      assignee: req.query.assignee,
      meetingId: req.query.meetingId,
    };
    const result = await actionItemService.listActionItems(req.user.userId, filters);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
}

async function getOverdueActionItems(req, res, next) {
  try {
    const items = await actionItemService.getOverdueActionItems();
    return successResponse(res, { actionItems: items, total: items.length });
  } catch (err) {
    next(err);
  }
}

// Manually trigger reminders for all overdue items right now
async function triggerReminders(req, res, next) {
  try {
    const overdueItems = await actionItemService.getOverdueActionItems();
    logger.info('Manual reminder trigger', { traceId: req.traceId, count: overdueItems.length });

    let sent = 0, failed = 0, skipped = 0;
    const results = [];

    for (const item of overdueItems) {
      const result = await sendReminderEmail(item, req.traceId);
      if (result.skipped) skipped++;
      else if (result.status === 'SUCCESS') sent++;
      else failed++;
      results.push({ actionItemId: item.id, task: item.task, assignee: item.assignee, ...result });
    }

    return successResponse(res, {
      overdueCount: overdueItems.length,
      sent, failed, skipped,
      results,
    });
  } catch (err) {
    next(err);
  }
}

// View reminder history
async function getReminderHistory(req, res, next) {
  try {
    const rows = query(
      'SELECT * FROM reminder_history ORDER BY sent_at DESC LIMIT 50'
    );
    return successResponse(res, { history: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createActionItem,
  updateStatus,
  listActionItems,
  getOverdueActionItems,
  triggerReminders,
  getReminderHistory,
};
