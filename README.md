# Meeting Intelligence Service

An AI-powered backend service for managing meetings, extracting actionable insights, and sending automated reminders for overdue action items.

## Tech Stack

- **Runtime**: Node.js + Express
- **Database**: SQLite (via sql.js — pure JavaScript, no native bindings)
- **AI Provider**: [Groq](https://console.groq.com) — FREE tier (llama3-8b-8192)
- **Email**: [Resend](https://resend.com) — FREE tier (3,000 emails/month)
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Scheduler**: node-cron
- **Validation**: Zod
- **Docs**: OpenAPI 3.0 / Swagger UI

---

## Getting Free API Keys

### 1. Groq API Key (AI / LLM) — 100% FREE
1. Go to [https://console.groq.com](https://console.groq.com)
2. Sign up with Google or email
3. Go to **API Keys** in the left sidebar
4. Click **Create API Key**
5. Copy the key — it starts with `gsk_...`
6. Free tier: 30 requests/minute, 14,400 requests/day

### 2. Resend API Key (Email reminders) — FREE
1. Go to [https://resend.com](https://resend.com)
2. Sign up (free account)
3. Go to **API Keys** → **Create API Key**
4. Copy the key — it starts with `re_...`
5. Free tier: 3,000 emails/month, 100/day
6. **Important**: For the `from` email, you can use `onboarding@resend.dev` for testing (no domain needed), or add your own domain.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
PORT=3000
NODE_ENV=development

# JWT Secret - make this a long random string
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars

# Groq API Key (FREE) - from https://console.groq.com
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# Resend API Key (FREE) - from https://resend.com
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev  # use this for testing

# Database path
DB_PATH=./data/meeting_intelligence.db

# Cron schedule (default: every hour)
REMINDER_CRON=0 * * * *

# For /api/evaluation endpoint
CANDIDATE_NAME=Your Name
CANDIDATE_EMAIL=your@email.com
REPO_URL=https://github.com/your/repo
DEPLOYED_URL=https://your-app.render.com
```

---

## Local Setup & Running

### Prerequisites
- Node.js 18+ (required for sql.js)
- npm

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/your/repo.git
cd meeting-intelligence-service

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY and RESEND_API_KEY

# 4. Start the server
npm start

# 5. For development with auto-reload
npm run dev
```

The server starts on `http://localhost:3000`.

**Swagger UI**: http://localhost:3000/api/docs

---

## Running Tests

```bash
npm test
```

Tests use an in-memory SQLite database and don't require any external API keys.

---

## Deployment (Render — Free Tier)

1. Push code to a public GitHub repository
2. Go to [https://render.com](https://render.com) and sign up (free)
3. Click **New** → **Web Service**
4. Connect your GitHub repo
5. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
6. Add environment variables in the Render dashboard (Settings → Environment)
7. Click **Deploy**

Your app will be live at `https://your-app-name.onrender.com`

**Note**: The free Render tier spins down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds.

---

## API Usage Examples

### 1. Register

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123","name":"Alice"}'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123"}'
# Save the token from the response
TOKEN="eyJhbGci..."
```

### 3. Create a Meeting

```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sprint Planning",
    "participants": ["alice@example.com", "bob@example.com"],
    "meetingDate": "2026-05-20T10:00:00Z",
    "transcript": [
      {"timestamp": "00:10", "speaker": "John", "text": "We should launch next Friday."},
      {"timestamp": "00:20", "speaker": "Alice", "text": "I will prepare release notes."}
    ]
  }'
# Save the meeting id
MEETING_ID="..."
```

### 4. Analyze Meeting (AI)

```bash
curl -X POST http://localhost:3000/api/meetings/$MEETING_ID/analyze \
  -H "Authorization: Bearer $TOKEN"
```

### 5. List Action Items

```bash
curl http://localhost:3000/api/action-items?status=PENDING \
  -H "Authorization: Bearer $TOKEN"
```

### 6. Update Action Item Status

```bash
curl -X PATCH http://localhost:3000/api/action-items/$ITEM_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "COMPLETED"}'
```

### 7. Get Overdue Items

```bash
curl http://localhost:3000/api/action-items/overdue \
  -H "Authorization: Bearer $TOKEN"
```
