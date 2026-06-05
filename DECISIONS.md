# Technical Decisions

## 1. Database: SQLite (via sql.js)

**Choice**: SQLite using `sql.js` (pure JavaScript implementation)

**Why chosen**:
- Zero infrastructure cost — no external database server needed
- Perfect for an internship project that needs to run locally and on free hosting tiers
- `sql.js` is pure JavaScript, so no native bindings or compilation required (works on Render free tier without issues)
- Full SQL support, transactions, foreign keys

**Alternatives considered**:
- **PostgreSQL** (via Supabase free tier): Better for production scale, but adds external dependency and configuration complexity
- **MongoDB Atlas** (free tier): Flexible schema, but SQL is more natural for relational data (meetings → action items)
- **better-sqlite3**: Faster, but requires native compilation which fails in constrained CI/container environments

**Trade-offs**:
- Not horizontally scalable (single-file DB), acceptable for this project scope
- sql.js loads the entire DB into memory — fine for small datasets

---

## 2. Authentication: JWT (JSON Web Tokens)

**Choice**: Stateless JWT authentication with bcrypt password hashing

**Why chosen**:
- Stateless — no session store needed, scales without Redis
- Industry standard for REST APIs
- Simple to implement and verify
- 7-day expiry balances security and UX

**Alternatives considered**:
- **Session-based auth**: Requires server-side session storage (Redis/DB), adds infrastructure
- **API keys**: Less user-friendly, harder to implement role-based access
- **OAuth2**: Overkill for this project scope

**Trade-offs**:
- Tokens cannot be revoked before expiry (no blacklist)
- Acceptable for an internship assignment; production would add a token blacklist or short expiry + refresh tokens

---

## 3. AI Provider: Groq (llama3-8b-8192)

**Choice**: Groq API with the `llama3-8b-8192` model

**Why chosen**:
- 100% free tier (30 req/min, 14,400 req/day) — no credit card required
- Extremely fast inference (often <1 second)
- llama3-8b is capable enough for structured meeting analysis
- Simple OpenAI-compatible API

**Alternatives considered**:
- **OpenAI GPT-4o**: Most capable, but requires paid API key
- **Google Gemini**: Has free tier, but more complex authentication
- **Claude (Anthropic)**: Excellent quality, but requires paid API
- **OpenRouter**: Aggregator with free models, but adds indirection

**Trade-offs**:
- llama3-8b may occasionally generate slightly imperfect JSON — handled with cleanup + error wrapping
- Temperature set to 0.1 to maximize consistency and reduce hallucinations

---

## 4. External Integration: Resend (Email)

**Choice**: Resend.com email API for reminder notifications

**Why chosen**:
- Free tier: 3,000 emails/month, no credit card required
- Simple REST API, single API key authentication
- No domain required for testing (use `onboarding@resend.dev`)
- Rich HTML email support

**Alternatives considered**:
- **Google Calendar API**: Free but requires OAuth 2.0 user login flow — complex to implement correctly in a backend service
- **Slack Webhook**: Easy but requires a Slack workspace
- **SendGrid**: Free tier (100/day) but requires domain verification
- **Telegram Bot API**: Free but requires users to have Telegram

**Trade-offs**:
- Email delivery depends on assignee emails being set on action items
- Production would need verified domain for better deliverability

---

## 5. Project Structure

```
src/
├── app.js              # Express app setup + bootstrap
├── controllers/        # Request/response handling only
├── services/           # Business logic
├── middleware/         # Cross-cutting concerns
├── models/             # (schema in database.js for simplicity)
├── routes/             # Route definitions
├── utils/              # Shared utilities
└── jobs/               # Scheduled tasks
```

**Why this structure**:
- Clear separation of concerns: controllers handle HTTP, services handle logic
- Testable: services can be unit tested without HTTP layer
- Familiar MVC-adjacent pattern that scales well

---

## 6. Hallucination Prevention Strategy

The AI prompt enforces grounding through several mechanisms:

1. **System prompt instruction**: Explicitly instructs the model to only use information from the transcript
2. **Low temperature (0.1)**: Reduces creative generation, increases determinism
3. **Citation requirement in prompt**: Forces the model to reference transcript timestamps for every output
4. **Post-processing validation**: `validateGrounding()` checks all citation timestamps exist in the transcript and logs warnings for any discrepancies
5. **Structured output**: JSON-only response format reduces free-form hallucination opportunities
