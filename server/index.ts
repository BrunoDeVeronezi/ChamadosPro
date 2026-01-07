import './env';
import express, { type Request, Response, NextFunction } from 'express';
import { pool } from './db';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { startReminderScheduler } from './reminderScheduler';
import { startEmailConfirmationCleanup } from './emailConfirmationCleanup';

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
app.use(
  express.json({
    limit: '10mb', // Aumentar limite para permitir upload de imagens base64
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

const ensureIntegrationSettingsColumns = async () => {
  try {
    const { rows } = await pool.query(
      "select to_regclass('public.integration_settings') as table_name"
    );
    if (!rows?.[0]?.table_name) {
      return;
    }

    await pool.query(`
      alter table integration_settings
        add column if not exists pix_key text,
        add column if not exists pix_key_type text,
        add column if not exists pix_account_holder text,
        add column if not exists whatsapp_status text default 'not_connected',
        add column if not exists whatsapp_access_token text,
        add column if not exists whatsapp_token_expires_at timestamp,
        add column if not exists whatsapp_business_account_id text,
        add column if not exists whatsapp_phone_number_id text,
        add column if not exists whatsapp_phone_number text;
    `);
    await pool.query("notify pgrst, 'reload schema'");
  } catch (error: any) {
    console.warn(
      '[ensureIntegrationSettingsColumns] Failed to ensure integration columns:',
      error?.message || error
    );
  }
};

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        // logLine = logLine.slice(0, 79) + 'â€¦';
      }

      // log(logLine);
    }
  });

  next();
});

(async () => {
  await ensureIntegrationSettingsColumns();
  const server = await registerRoutes(app);

  // Configura Socket.io para comunicaÃ§Ã£o em tempo real
  // Temporariamente comentado atÃ© dependÃªncias serem instaladas
  try {
    const { setupSocketIO } = await import('./socket');
    const io = setupSocketIO(server);
  } catch (error) {
    console.warn(
      '[Socket.io] Erro ao configurar Socket.io:',
      error instanceof Error ? error.message : error
    );
    console.warn('[Socket.io] Continuando sem Socket.io');
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5180', 10);
  server.listen(port, '0.0.0.0', () => {
    // log(`serving on port ${port}`);
    startReminderScheduler();
    startEmailConfirmationCleanup();
  });
})();
