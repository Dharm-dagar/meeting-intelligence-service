const cron = require('node-cron');
const { getOverdueActionItems } = require('../services/actionItemService');
const { sendReminderEmail } = require('../services/reminderService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

let scheduledTask = null;

function startReminderJob() {
  // Runs every hour by default (configurable via REMINDER_CRON env)
  const schedule = process.env.REMINDER_CRON || '* * * * *';

  scheduledTask = cron.schedule(schedule, async () => {
    const traceId = uuidv4();
    logger.info('Reminder job triggered', { traceId, schedule });

    try {
      const overdueItems = await getOverdueActionItems();
      logger.info(`Found ${overdueItems.length} overdue action items`, { traceId });

      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (const item of overdueItems) {
        try {
          const result = await sendReminderEmail(item, traceId);
          if (result.skipped) skipped++;
          else if (result.status === 'SUCCESS') sent++;
          else failed++;
        } catch (err) {
          failed++;
          logger.error('Error sending reminder for action item', {
            traceId,
            actionItemId: item.id,
            error: err.message,
          });
        }
      }

      logger.info('Reminder job completed', { traceId, sent, failed, skipped });
    } catch (err) {
      logger.error('Reminder job failed', { traceId, error: err.message, stack: err.stack });
    }
  });

  logger.info('Reminder job scheduled', { schedule });
  return scheduledTask;
}

function stopReminderJob() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

module.exports = { startReminderJob, stopReminderJob };
