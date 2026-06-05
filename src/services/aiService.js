const axios = require('axios');
const logger = require('../utils/logger');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

async function analyzeMeeting(meeting, traceId) {
  const transcriptText = meeting.transcript
    .map((t) => `[${t.timestamp}] ${t.speaker}: ${t.text}`)
    .join('\n');

  const systemPrompt = `You are a meeting analysis assistant. Your job is to analyze meeting transcripts and extract structured insights.

CRITICAL RULES:
1. ONLY use information explicitly stated in the transcript. Do NOT invent or infer.
2. Every insight MUST include citations referencing the exact timestamp(s) from the transcript.
3. If something is not in the transcript, do NOT include it.
4. Assignees for action items must be speakers or people explicitly mentioned in the transcript.
5. Return ONLY valid JSON with no extra text, no markdown, no explanation.

JSON output format:
{
  "summary": [
    { "text": "...", "citations": [{ "timestamp": "00:10" }] }
  ],
  "actionItems": [
    { "task": "...", "assignee": "...", "dueDate": null, "citations": [{ "timestamp": "00:20" }] }
  ],
  "decisions": [
    { "text": "...", "citations": [{ "timestamp": "00:30" }] }
  ],
  "followUpSuggestions": [
    { "text": "...", "citations": [{ "timestamp": "00:40" }] }
  ]
}`;

  const userPrompt = `Meeting Title: ${meeting.title}
Participants: ${meeting.participants.join(', ')}
Date: ${meeting.meeting_date || meeting.meetingDate}

Transcript:
${transcriptText}

Analyze this transcript and return structured JSON insights. Remember: only cite information explicitly in the transcript above.`;

  logger.info('Calling Groq API for meeting analysis', { traceId, meetingId: meeting.id });

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices[0].message.content.trim();
    logger.debug('Groq raw response', { traceId, content });

    // Strip markdown code fences if present
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validate citations exist
    validateGrounding(parsed, meeting.transcript);

    return parsed;
  } catch (err) {
    if (err.response) {
      logger.error('Groq API error', {
        traceId,
        status: err.response.status,
        data: err.response.data,
      });
      const apiErr = new Error(`AI provider error: ${err.response.data?.error?.message || 'Unknown error'}`);
      apiErr.statusCode = 502;
      apiErr.code = 'AI_PROVIDER_ERROR';
      throw apiErr;
    }
    if (err instanceof SyntaxError) {
      logger.error('Failed to parse AI response as JSON', { traceId, error: err.message });
      const parseErr = new Error('AI returned invalid response format');
      parseErr.statusCode = 502;
      parseErr.code = 'AI_PARSE_ERROR';
      throw parseErr;
    }
    throw err;
  }
}

function validateGrounding(analysis, transcript) {
  const validTimestamps = new Set(transcript.map((t) => t.timestamp));

  function checkCitations(items, type) {
    for (const item of items || []) {
      if (!item.citations || item.citations.length === 0) {
        logger.warn(`${type} item missing citations`, { item: item.text || item.task });
      }
      for (const cite of item.citations || []) {
        if (!validTimestamps.has(cite.timestamp)) {
          logger.warn(`Citation timestamp not in transcript`, {
            type,
            timestamp: cite.timestamp,
            validTimestamps: [...validTimestamps],
          });
          // Don't throw — warn only, invalid timestamps might be acceptable minor AI variance
        }
      }
    }
  }

  checkCitations(analysis.summary, 'summary');
  checkCitations(analysis.actionItems, 'actionItems');
  checkCitations(analysis.decisions, 'decisions');
  checkCitations(analysis.followUpSuggestions, 'followUpSuggestions');
}

module.exports = { analyzeMeeting };
