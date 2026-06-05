# Changelog

## [1.0.0] - 2026-06-03

### Milestone 1: Project Setup & Infrastructure
- Initialized Node.js project with Express
- Set up SQLite database via `sql.js` (pure JS, no native bindings)
- Implemented database schema: users, meetings, meeting_analyses, action_items, reminder_history
- Added unified API response format (`{ traceId, success, data/error }`)
- Implemented trace ID middleware (generates UUID per request, included in all logs and responses)
- Configured structured JSON logging with timestamp, traceId, method, path, status
- Added global error handler middleware (handles Zod errors, JWT errors, operational errors, unknown errors)

### Milestone 2: Authentication
- Implemented user registration with bcrypt password hashing (10 rounds)
- Implemented JWT login (7-day expiry)
- Added JWT auth middleware for protected routes
- Input validation via Zod schemas (email format, password min length)

### Milestone 3: Meeting Management
- `POST /api/meetings` — create meeting with transcript
- `GET /api/meetings` — list with pagination
- `GET /api/meetings/:id` — get single meeting (includes analysis if present)
- Input validation: participants must be valid emails, transcript must be non-empty, date must be ISO 8601

### Milestone 4: AI Analysis with Citation Grounding
- Integrated Groq API (llama3-8b-8192, free tier)
- `POST /api/meetings/:id/analyze` — generates summary, action items, decisions, follow-up suggestions
- All AI outputs include citations referencing transcript timestamps
- System prompt enforces strict grounding (no hallucination)
- Post-processing validates citation timestamps against actual transcript
- Low temperature (0.1) for deterministic outputs
- Error handling for Groq API failures and JSON parse errors

### Milestone 5: Action Item Management
- `POST /api/action-items` — manual creation
- `GET /api/action-items` — list with filtering (status, assignee, meetingId) and pagination
- `PATCH /api/action-items/:id/status` — update status (PENDING / IN_PROGRESS / COMPLETED)
- `GET /api/action-items/overdue` — items where status != COMPLETED and dueDate < now
- Auto-creation of action items from AI analysis results

### Milestone 6: Scheduled Reminders & Email Integration
- Implemented `node-cron` scheduled job (default: every hour)
- Job identifies all overdue action items and sends email reminders
- Integrated Resend email API (free tier: 3,000 emails/month)
- HTML email template with action item details and due date
- Reminder history recorded in DB (channel, status, error_message)
- Graceful handling when assignee email is missing (skips, logs warning)

### Milestone 7: API Documentation & Final Polish
- OpenAPI 3.0 spec written in YAML (`docs/openapi.yaml`)
- Swagger UI served at `/api/docs`
- JSON spec available at `/api/docs.json`
- `GET /health` endpoint
- `GET /api/evaluation` endpoint with feature list
- CORS enabled for all origins
- Environment variable documentation
- Complete README with setup, deployment, and API examples
- All documentation files: DECISIONS.md, AI_APPROACH.md, TESTING.md, CHANGELOG.md, CHECKLIST.md

### Milestone 8: Testing
- Unit/integration tests using Jest + Supertest
- In-memory SQLite for test isolation (no file system, no external services)
- 23 test cases covering auth, meetings, action items, response format
