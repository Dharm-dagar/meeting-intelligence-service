const axios  = require('axios');
const { v4: uuidv4 } = require('uuid');
const { run, get }   = require('../utils/database');
const logger         = require('../utils/logger');

const RESEND_API_URL  = 'https://api.resend.com/emails';
const COOLDOWN_MINUTES = 30;

// Build styled HTML email body
function buildEmailHtml(actionItem) {
  const dueDateStr = actionItem.due_date
    ? new Date(actionItem.due_date).toLocaleDateString('en-US', { dateStyle: 'long' })
    : 'No due date set';

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f3f4f6;">
  <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#6c63ff,#f0605a);padding:26px 28px;">
      <h2 style="margin:0;color:#fff;font-size:20px;">⚠️ Overdue Action Item</h2>
      <p style="margin:6px 0 0;color:rgba(255,255,255,.85);font-size:14px;">This task needs your immediate attention</p>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 18px;color:#374151;font-size:15px;">Hi <strong>${actionItem.assignee}</strong>,</p>
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:8px;margin-bottom:22px;">
        <p style="margin:0;font-size:18px;font-weight:700;color:#92400e;">${actionItem.task}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:10px 0;color:#6b7280;width:38%;">Assigned To</td>
          <td style="padding:10px 0;font-weight:600;">${actionItem.assignee}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:10px 0;color:#6b7280;">Due Date</td>
          <td style="padding:10px 0;font-weight:700;color:#dc2626;">${dueDateStr}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#6b7280;">Status</td>
          <td style="padding:10px 0;">
            <span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">${actionItem.status}</span>
          </td>
        </tr>
      </table>
      <p style="color:#6b7280;font-size:13px;margin:0;">Please update the status of this action item as soon as possible.</p>
    </div>
    <div style="background:#f9fafb;padding:14px 28px;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by <strong>Hintro Meeting Intelligence</strong></p>
    </div>
  </div>
</body>
</html>`;
}

// Record a reminder attempt in history
function recordHistory(actionItemId, recipient, channel, status, errorMessage = null) {
  run(
    'INSERT INTO reminder_history (id, action_item_id, sent_at, channel, recipient, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), actionItemId, new Date().toISOString(), channel, recipient, status, errorMessage]
  );
}

// Send one email via Resend
async function sendOneEmail(to, subject, html, apiKey) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  await axios.post(
    RESEND_API_URL,
    { from: fromEmail, to: [to], subject, html },
    { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 10000 }
  );
}

// Main function: send reminders for one action item (primary + CC)
async function sendReminderEmail(actionItem, traceId) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn('RESEND_API_KEY not configured', { traceId });
    return { skipped: true, reason: 'RESEND_API_KEY not configured' };
  }

  const primaryEmail = actionItem.assignee_email;
  const extraEmails  = Array.isArray(actionItem.extra_emails) ? actionItem.extra_emails : [];
  const allEmails    = [...new Set([primaryEmail, ...extraEmails].filter(Boolean))];

  if (allEmails.length === 0) {
    logger.warn('No recipient emails for action item', { traceId, actionItemId: actionItem.id });
    return { skipped: true, reason: 'No email addresses set on this action item' };
  }

  // Cooldown check: skip if a successful reminder was sent within COOLDOWN_MINUTES
  const cooldownAgo    = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();
  const recentReminder = get(
    `SELECT id FROM reminder_history
     WHERE action_item_id = ? AND status = 'SUCCESS' AND sent_at > ?
     LIMIT 1`,
    [actionItem.id, cooldownAgo]
  );
  if (recentReminder) {
    logger.info('Skipping reminder — cooldown active', { traceId, actionItemId: actionItem.id });
    return { skipped: true, reason: `Already reminded within last ${COOLDOWN_MINUTES} minutes` };
  }

  const subject = `⚠️ Overdue: ${actionItem.task.substring(0, 60)}`;
  const html    = buildEmailHtml(actionItem);

  let anySuccess = false;
  let lastError  = null;
  const results  = [];

  for (const email of allEmails) {
    let status = 'SUCCESS';
    let errMsg = null;
    try {
      await sendOneEmail(email, subject, html, apiKey);
      logger.info('Reminder email sent', { traceId, actionItemId: actionItem.id, to: email });
      anySuccess = true;
    } catch (err) {
      status = 'FAILED';
      errMsg = err.response?.data?.message || err.message;
      lastError = errMsg;
      logger.error('Failed to send reminder', { traceId, to: email, error: errMsg });
    }
    recordHistory(actionItem.id, email, 'EMAIL', status, errMsg);
    results.push({ email, status, error: errMsg });
  }

  return {
    status:    anySuccess ? 'SUCCESS' : 'FAILED',
    errorMessage: lastError,
    recipients: results,
  };
}

module.exports = { sendReminderEmail };
