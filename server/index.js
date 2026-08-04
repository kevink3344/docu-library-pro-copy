import './config.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import healthRouter from './routes/health.js';
import infoRouter from './routes/info.js';
import settingsRouter from './routes/settings.js';
import authRouter from './routes/auth.js';
import apiRouter from './routes/api.js';
import systemMessagesRouter from './routes/system-messages.js';
import { settingsTabsRouter } from './routes/settings-tabs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// ---------------------------------------------------------------------------
// Swagger / OpenAPI setup
// ---------------------------------------------------------------------------

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'KBB Portal API',
      version: '1.0.0',
      description:
        'REST API for the Knowledge Base Document Library. '
        + 'Provides CRUD operations for organizations, locations, departments, '
        + 'documents, teams, users, and more.',
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: 'Development server' },
    ],
  },
  apis: [
    './server/swagger.js',
    './server/routes/*.js',
  ],
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'KBB Portal API Docs',
  }),
);

// Serve raw OpenAPI spec as JSON
app.get('/api-docs.json', (req, res) => {
  res.json(swaggerSpec);
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use('/api/health', healthRouter);
app.use('/api/info', infoRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/settings', settingsTabsRouter);
app.use('/api/auth', authRouter);
app.use('/api/system-messages', systemMessagesRouter);
app.use('/api', apiRouter);

// Serve the Vite-built frontend (production) — in dev, Vite runs on a separate port
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback — all non-API routes serve index.html
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});