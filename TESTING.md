# Testing Documentation

## Test Setup

Tests use an in-memory SQLite database (no file I/O) and mock all external API calls. No real API keys are required to run tests.

```bash
npm test
```

---

## Test Scenarios Covered

### Health & Evaluation
- `GET /health` returns `{ status: "UP" }`
- `GET /api/evaluation` returns candidate metadata with features list

### Authentication
| Scenario | Expected |
|----------|----------|
| Register with valid data | 201, returns JWT token |
| Register with duplicate email | 409, `EMAIL_TAKEN` |
| Register with invalid email | 400, `VALIDATION_ERROR` |
| Register with short password | 400, `VALIDATION_ERROR` |
| Login with correct credentials | 200, returns JWT token |
| Login with wrong password | 401, `INVALID_CREDENTIALS` |
| Access protected route without token | 401, `UNAUTHORIZED` |

### Meeting Management
| Scenario | Expected |
|----------|----------|
| Create meeting with valid data | 201, meeting object returned |
| Create meeting with missing title | 400, `VALIDATION_ERROR` |
| Create meeting with invalid participant email | 400, `VALIDATION_ERROR` |
| Create meeting with empty transcript | 400, `VALIDATION_ERROR` |
| Get meeting by ID (owner) | 200, meeting with transcript |
| Get meeting by non-existent ID | 404, `NOT_FOUND` |
| List meetings with pagination | 200, `{ meetings, pagination }` |

### Action Items
| Scenario | Expected |
|----------|----------|
| Create action item with valid data | 201, status=PENDING |
| Create without required `task` field | 400, `VALIDATION_ERROR` |
| Update status to IN_PROGRESS | 200, updated item |
| Update status to COMPLETED | 200, updated item |
| Update with invalid status value | 400, `VALIDATION_ERROR` |
| List all action items | 200, paginated list |
| Filter by status | 200, only matching items |
| Get overdue items | 200, items where dueDate < now and status != COMPLETED |

### Response Format
| Scenario | Expected |
|----------|----------|
| Every API response has `traceId` | traceId present on all responses |
| Every API response has `success` field | true on success, false on error |
| Non-existent route | 404 with proper error format |

---

## Edge Cases Considered

1. **Duplicate email registration**: Returns 409 instead of crashing
2. **JWT tampered or expired**: Returns 401 with descriptive error code
3. **Accessing another user's meeting**: Returns 404 (not 403) — avoids leaking resource existence
4. **Action item with no due date**: Creates successfully, never appears in overdue
5. **Action item with past due date and COMPLETED status**: Not returned in overdue
6. **Empty transcript array**: Rejected at validation layer (min 1 entry)
7. **Invalid ISO date format**: Rejected at validation (Zod datetime check)
8. **Malformed JSON body**: Express JSON parser returns 400 automatically
9. **Unknown route**: Returns 404 with unified error format

---

## Limitations Discovered

1. **AI analysis tests**: The `POST /meetings/:id/analyze` endpoint requires a real Groq API key, so it's not covered in automated unit tests. Integration tests would need a mock or a test API key.
2. **Reminder job tests**: node-cron scheduling is not unit tested; the job logic (`getOverdueActionItems` + `sendReminderEmail`) is tested indirectly through the service layer.
3. **Concurrency**: SQLite with sql.js is single-threaded; concurrent writes are not tested and could cause issues under high load.
4. **Email delivery**: Resend integration is not unit tested (would require mocking axios). Manual testing was done against Resend's sandbox.

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode (development)
npx jest --watch
```

Expected output:
```
PASS tests/api.test.js
  Health & Evaluation
    ✓ GET /health returns UP
    ✓ GET /api/evaluation returns candidate info
  Authentication
    ✓ POST /api/auth/register - creates user
    ✓ POST /api/auth/register - duplicate email returns 409
    ✓ POST /api/auth/register - invalid email returns 400
    ✓ POST /api/auth/login - returns JWT token
    ✓ POST /api/auth/login - wrong password returns 401
    ✓ Protected route without token returns 401
  Meetings
    ✓ POST /api/meetings - creates meeting
    ✓ POST /api/meetings - missing title returns 400
    ✓ POST /api/meetings - invalid participant email returns 400
    ✓ GET /api/meetings - lists meetings with pagination
    ✓ GET /api/meetings/:id - returns meeting
    ✓ GET /api/meetings/nonexistent - returns 404
  Action Items
    ✓ POST /api/action-items - creates action item
    ✓ POST /api/action-items - missing task returns 400
    ✓ PATCH /api/action-items/:id/status - updates status
    ✓ PATCH /api/action-items/:id/status - invalid status returns 400
    ✓ GET /api/action-items - lists action items
    ✓ GET /api/action-items?status=IN_PROGRESS - filters by status
    ✓ GET /api/action-items/overdue - returns overdue items
  Response Format
    ✓ All responses have traceId, success, data/error
    ✓ 404 route returns proper error format
```
