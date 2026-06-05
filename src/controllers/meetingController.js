const { createMeetingSchema, paginationSchema } = require('../utils/validation');
const meetingService = require('../services/meetingService');
const aiService = require('../services/aiService');
const actionItemService = require('../services/actionItemService');
const { successResponse } = require('../utils/response');
const logger = require('../utils/logger');

async function createMeeting(req, res, next) {
  try {
    const data = createMeetingSchema.parse(req.body);
    const meeting = await meetingService.createMeeting(req.user.userId, data);
    logger.info('Meeting created', { traceId: req.traceId, meetingId: meeting.id });
    return successResponse(res, meeting, 201);
  } catch (err) {
    next(err);
  }
}

async function getMeeting(req, res, next) {
  try {
    const meeting = await meetingService.getMeetingById(req.params.id, req.user.userId);
    return successResponse(res, meeting);
  } catch (err) {
    next(err);
  }
}

async function listMeetings(req, res, next) {
  try {
    const pagination = paginationSchema.parse(req.query);
    const result = await meetingService.listMeetings(req.user.userId, pagination);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
}

async function analyzeMeeting(req, res, next) {
  try {
    const meeting = await meetingService.getMeetingById(req.params.id, req.user.userId);

    logger.info('Starting AI analysis', { traceId: req.traceId, meetingId: meeting.id });
    const analysis = await aiService.analyzeMeeting(meeting, req.traceId);

    // Save analysis
    const saved = await meetingService.saveMeetingAnalysis(meeting.id, analysis);

    // Bulk-create action items from AI output
    if (analysis.actionItems && analysis.actionItems.length > 0) {
      const created = await actionItemService.bulkCreateFromAnalysis(
        req.user.userId,
        meeting.id,
        analysis.actionItems
      );
      saved.actionItemsCreated = created.length;
    }

    logger.info('Meeting analysis complete', { traceId: req.traceId, meetingId: meeting.id });
    return successResponse(res, saved);
  } catch (err) {
    next(err);
  }
}

module.exports = { createMeeting, getMeeting, listMeetings, analyzeMeeting };
