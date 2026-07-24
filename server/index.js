import './config.js';
import express from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import healthRouter from './routes/health.js';
import infoRouter from './routes/info.js';
import settingsRouter from './routes/settings.js';
import authRouter from './routes/auth.js';
import apiRouter from './routes/api.js';

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
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});