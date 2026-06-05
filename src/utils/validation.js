const { z } = require('zod');

const registerSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name:     z.string().min(1, 'Name is required').max(100),
});

const loginSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const createMeetingSchema = z.object({
  title:       z.string().min(1, 'Meeting title is required').max(200),
  participants: z.array(z.string().email('Invalid participant email')).min(1, 'At least one participant required'),
  meetingDate: z.string().datetime('Invalid date — use ISO 8601'),
  transcript:  z.array(z.object({
    timestamp: z.string().min(1, 'Timestamp required'),
    speaker:   z.string().min(1, 'Speaker required'),
    text:      z.string().min(1, 'Text required'),
  })).min(1, 'Transcript must have at least one entry'),
});

const createActionItemSchema = z.object({
  meetingId:     z.string().optional(),
  task:          z.string().min(1, 'Task description is required').max(500),
  assignee:      z.string().min(1, 'Assignee name is required'),
  assigneeEmail: z.string().email('Invalid assignee email').optional().or(z.literal('')),
  extraEmails:   z.array(z.string().email('Invalid CC email')).optional(),
  dueDate:       z.string().datetime('Invalid date — use ISO 8601').optional(),
  citations:     z.array(z.object({ timestamp: z.string() })).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED'], {
    errorMap: () => ({ message: 'Status must be PENDING, IN_PROGRESS, or COMPLETED' }),
  }),
});

const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

module.exports = {
  registerSchema,
  loginSchema,
  createMeetingSchema,
  createActionItemSchema,
  updateStatusSchema,
  paginationSchema,
};
