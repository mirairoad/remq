/**
 * HTTP gateway — exposes Hound over REST.
 *
 * Endpoints:
 *   POST /emit         — emit a single job, returns { jobId }
 *   POST /emit/batch   — emit multiple jobs, returns { jobIds }
 *   GET  /health       — liveness check
 *
 * Auth (optional): pass Authorization: Bearer <token> on all requests.
 *
 * @module
 */
import type { EmitOptions } from '../../types/index.ts';
import type { Hound } from '../hound/mod.ts';

export type GatewayOptions = {
  port: number;
  hostname?: string;
  hound: Hound<any>;
  /** Optional Bearer token. When set, all requests must include Authorization: Bearer <token>. */
  auth?: string;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function checkAuth(req: Request, token?: string): Response | null {
  if (!token) return null;
  const header = req.headers.get('Authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided !== token) return new Response('Unauthorized', { status: 401 });
  return null;
}

export function createGateway(options: GatewayOptions) {
  const { port, hostname = '0.0.0.0', hound, auth } = options;

  return Deno.serve(
    { hostname, port },
    async (req: Request): Promise<Response> => {
      const authError = checkAuth(req, auth);
      if (authError) return authError;

      const url = new URL(req.url);

      if (req.method === 'GET' && url.pathname === '/health') {
        return json({ status: 'ok' });
      }

      if (req.method === 'POST' && url.pathname === '/emit') {
        try {
          const body = await req.json() as {
            event: string;
            data?: unknown;
            options?: EmitOptions;
          };
          if (!body?.event) return json({ error: 'event is required' }, 400);
          const jobId = await hound.emitAsync(body.event, body.data, body.options);
          return json({ jobId });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return json({ error: msg }, 500);
        }
      }

      if (req.method === 'POST' && url.pathname === '/emit/batch') {
        try {
          const jobs = await req.json() as Array<{
            event: string;
            data?: unknown;
            options?: EmitOptions;
          }>;
          if (!Array.isArray(jobs)) return json({ error: 'body must be an array' }, 400);
          const jobIds = await Promise.all(
            jobs.map((j) => hound.emitAsync(j.event, j.data, j.options)),
          );
          return json({ jobIds });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return json({ error: msg }, 500);
        }
      }

      return new Response(null, { status: 404 });
    },
  );
}
