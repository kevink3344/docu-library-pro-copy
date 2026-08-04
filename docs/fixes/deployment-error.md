# Deployment Error: "Cannot GET /"

## Symptom

When deploying to Azure App Service (or any production Node.js host), visiting the root URL returns:

```
Cannot GET /
```

## Root Cause

The Express backend (`server/index.js`) only defines API routes (`/api/*`, `/api-docs`, etc.) — there is **no route handler for `GET /`**. In development, Vite's dev server serves the frontend on `localhost:5173` and proxies API calls to `localhost:3001`. In production, there is no Vite dev server — only the Express backend runs, and it doesn't know how to serve the frontend.

Additionally, Azure App Service sends a health check to `GET /` and expects a 200 response. If it gets a 404, the deployment may fail or the app may not start.

## Fix

### 1. Serve the Vite build output from Express

Add this to `server/index.js` **after** all API route registrations and **before** the error handler:

```js
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the Vite-built frontend — in dev, Vite runs on a separate port so this doesn't interfere
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback — all non-API routes serve index.html
// Note: Express 5.x uses {*path} syntax; Express 4.x uses *
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});
```

> **Important**: Do NOT wrap this in `if (process.env.NODE_ENV === 'production')`. Azure App Service does not always set `NODE_ENV=production`, so the guard would prevent the static files from being served. In development, this is harmless because Vite runs on a separate port (5173) and handles the frontend independently.

### 2. Update the build/start scripts

Ensure `package.json` has:

```json
{
  "scripts": {
    "build": "vite build",
    "start": "node server/index.js"
  }
}
```

Azure App Service runs `npm run build` then `npm start` by default (configurable via App Settings).

### 3. Ensure the Vite build output goes to `dist/`

The default Vite output directory is `dist/`. If you've customized it in `vite.config.js`, update the `distPath` above accordingly.

### 4. Azure-specific: Set WEBSITES_PORT

If your Express server listens on a custom port (e.g., `process.env.PORT || 3001`), Azure injects `PORT` automatically. No additional config is needed. If you need to override, set `WEBSITES_PORT` in Azure App Settings.

## Why This Happens

| Environment | Frontend | Backend | How they connect |
|---|---|---|---|
| **Dev** (`npm run dev`) | Vite dev server (port 5173) | Express (port 3001) | Vite proxies `/api` to Express |
| **Production** (`npm start`) | Static files from `dist/` | Express (port from `PORT` env) | Express serves both frontend and API |

In production, Express is the **only** server running, so it must serve both the API and the static frontend files.
