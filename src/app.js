require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const traceMiddleware = require('./middleware/trace');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes/index');
const { getDb } = require('./utils/database');
const { startReminderJob } = require('./jobs/reminderJob');
const logger = require('./utils/logger');

const app = express();

// CORS
app.use(cors({ origin: '*' }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Trace ID on every request
app.use(traceMiddleware);

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Evaluation endpoint
app.get('/api/evaluation', (req, res) => {
  res.json({
    traceId: res.locals.traceId,
    success: true,
    data: {
      candidateName: process.env.CANDIDATE_NAME || 'Your Name',
      email: process.env.CANDIDATE_EMAIL || 'your@email.com',
      repositoryUrl: process.env.REPO_URL || 'https://github.com/your/repo',
      deployedUrl: process.env.DEPLOYED_URL || 'https://your-app.render.com',
      externalIntegration: 'Resend Email API',
      features: [
        'JWT Authentication',
        'Meeting Management with Pagination',
        'AI Analysis via Groq (llama-3.3-70b-versatile)',
        'Transcript-grounded Citations',
        'Action Item Management',
        'Overdue Detection',
        'Scheduled Reminder Job (node-cron)',
        'Email Reminders via Resend',
        'Unified API Response Format',
        'Request Trace IDs',
        'Structured Logging',
        'Input Validation (Zod)',
        'Global Error Handling',
        'OpenAPI/Swagger Documentation',
      ],
    },
  });
});

// Swagger docs
try {
  const swaggerDoc = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
  app.get('/api/docs.json', (req, res) => res.json(swaggerDoc));
} catch (e) {
  logger.warn('Swagger docs not loaded', { error: e.message });
}

// API routes
app.use('/api', routes);

// Serve frontend SPA from /public
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback — any non-API route serves index.html
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 (only for /api routes that weren't matched above)
app.use((req, res) => {
  res.status(404).json({
    traceId: res.locals.traceId,
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

// Global error handler
app.use(errorHandler);

// Bootstrap
async function bootstrap() {
  await getDb(); // init DB and schema
  logger.info('Database initialized');

  if (process.env.NODE_ENV !== 'test') {
    startReminderJob();
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Meeting Intelligence Service started`, { port: PORT });
    logger.info(`Swagger docs available at http://localhost:${PORT}/api/docs`);
  });
}

if (require.main === module) {
  bootstrap().catch((err) => {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  });
}

module.exports = app;
