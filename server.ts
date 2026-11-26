import express from 'express';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

interface ProbeBody {
  url?: string;
  timeoutMs?: number;
  allowSelfSignedCert?: boolean;
}

interface CraftyLoginBody {
  baseUrl?: string;
  username?: string;
  password?: string;
  allowSelfSignedCert?: boolean;
}

interface CraftyProxyBody {
  baseUrl?: string;
  token?: string;
  method?: string;
  path?: string;
  body?: unknown;
  rawBody?: string;
  contentType?: string;
  allowSelfSignedCert?: boolean;
}

const BLOCKED_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.goog',
]);

function validateTargetUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Malformed URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Unsupported protocol (use http or https)' };
  }
  if (!parsed.hostname) {
    return { ok: false, reason: 'Missing host' };
  }
  if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { ok: false, reason: 'Host is blocked by security policy' };
  }
  return { ok: true, url: parsed };
}

function sendHttpRequest(options: {
  url: URL;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  allowSelfSignedCert: boolean;
}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const startNs = process.hrtime.bigint();
    const transport = options.url.protocol === 'https:' ? https : http;
    const reqOptions: https.RequestOptions = {
      method: options.method,
      hostname: options.url.hostname,
      port: options.url.port
        ? Number(options.url.port)
        : options.url.protocol === 'https:'
          ? 443
          : 80,
      path: `${options.url.pathname || '/'}${options.url.search || ''}`,
      headers: options.headers,
      timeout: options.timeoutMs,
    };

    if (options.url.protocol === 'https:') {
      reqOptions.rejectUnauthorized = !options.allowSelfSignedCert;
    }

    const req = transport.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const latencyMs = Number((process.hrtime.bigint() - startNs) / 1_000_000n);
        resolve({
          statusCode: res.statusCode ?? 200,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8'),
          latencyMs,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Timed out after ${options.timeoutMs}ms`));
    });
    req.on('error', (err) => reject(err));

    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.post('/api/probe', async (req, res) => {
    const body = (req.body || {}) as ProbeBody;
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (!rawUrl) {
      res.json({ reachable: false, reason: 'URL is blank' });
      return;
    }

    const check = validateTargetUrl(rawUrl);
    if (!check.ok) {
      res.json({ reachable: false, reason: check.reason });
      return;
    }

    const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 1500, 300), 15000);
    try {
      const result = await sendHttpRequest({
        url: check.url,
        method: 'HEAD',
        timeoutMs,
        allowSelfSignedCert: Boolean(body.allowSelfSignedCert),
      });
      res.json({
        reachable: true,
        latencyMs: result.latencyMs,
        statusCode: result.statusCode,
      });
    } catch (err) {
      res.json({
        reachable: false,
        reason: err instanceof Error ? err.message : 'Connection failed',
      });
    }
  });

  app.post('/api/crafty/login', async (req, res) => {
    const body = (req.body || {}) as CraftyLoginBody;
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim().replace(/\/+$/, '') : '';
    const check = validateTargetUrl(`${baseUrl}/api/v2/auth/login`);
    if (!check.ok) {
      res.status(400).json({ ok: false, error: check.reason });
      return;
    }

    const payload = JSON.stringify({
      username: body.username || '',
      password: body.password || '',
    });

    try {
      const result = await sendHttpRequest({
        url: check.url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(Buffer.byteLength(payload)),
        },
        body: payload,
        timeoutMs: 8000,
        allowSelfSignedCert: Boolean(body.allowSelfSignedCert),
      });

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(result.body);
      } catch {
        parsed = { raw: result.body };
      }

      res.status(result.statusCode).json({
        ok: result.statusCode >= 200 && result.statusCode < 300,
        status: result.statusCode,
        data: parsed,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to connect to Crafty server',
      });
    }
  });

  app.post('/api/crafty/request', async (req, res) => {
    const body = (req.body || {}) as CraftyProxyBody;
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim().replace(/\/+$/, '') : '';
    const apiPath = typeof body.path === 'string' ? body.path : '';
    if (!apiPath.startsWith('/')) {
      res.status(400).json({ ok: false, error: 'API path must start with /' });
      return;
    }

    const check = validateTargetUrl(`${baseUrl}/api/v2${apiPath}`);
    if (!check.ok) {
      res.status(400).json({ ok: false, error: check.reason });
      return;
    }

    const method = (body.method || 'GET').toUpperCase();
    const allowedMethods = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);
    if (!allowedMethods.has(method)) {
      res.status(400).json({ ok: false, error: 'Unsupported HTTP method' });
      return;
    }

    const headers: Record<string, string> = {};
    if (body.token) {
      headers.Authorization = `Bearer ${body.token}`;
    }

    let payload: string | undefined;
    if (typeof body.rawBody === 'string') {
      payload = body.rawBody;
      headers['Content-Type'] = body.contentType || 'text/plain';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    } else if (body.body !== undefined) {
      payload = JSON.stringify(body.body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }

    try {
      const result = await sendHttpRequest({
        url: check.url,
        method,
        headers,
        body: payload,
        timeoutMs: 12000,
        allowSelfSignedCert: Boolean(body.allowSelfSignedCert),
      });

      let parsed: unknown = result.body;
      try {
        parsed = JSON.parse(result.body);
      } catch {
        // Return plain text for raw logs / file contents
      }

      res.status(200).json({
        ok: result.statusCode >= 200 && result.statusCode < 300,
        status: result.statusCode,
        data: parsed,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        status: 502,
        error: err instanceof Error ? err.message : 'Crafty proxy request failed',
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScamController listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
