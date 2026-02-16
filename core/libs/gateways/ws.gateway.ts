/**
 * WebSocket gateway – spawns a server on 0.0.0.0:port and upgrades HTTP requests to WebSocket.
 * Uses Deno's built-in Deno.serve and Deno.upgradeWebSocket.
 */

import { TaskManager } from '../task-manager/mod.ts';

export type WsConnectionHandler = (ws: WebSocket) => void;

export type WsGatewayOptions = {
  port: number;
  hostname?: string;
  taskManager: TaskManager<any>;
  onConnection?: WsConnectionHandler;
};

/**
 * Starts a WebSocket server bound to 0.0.0.0 (or options.hostname) and the given port.
 * Upgrades HTTP requests with Upgrade: websocket to WebSocket connections.
 *
 * @param options.port - Port to listen on.
 * @param options.hostname - Optional hostname (default "0.0.0.0").
 * @param options.onConnection - Optional callback invoked for each new WebSocket.
 * @returns The Deno server (e.g. for shutdown).
 */
export function createWsGateway(options: WsGatewayOptions) {
  const { port, hostname = '0.0.0.0', onConnection } = options;

  const server = Deno.serve(
    { hostname, port },
    (req: Request): Response | Promise<Response> => {
      const upgrade = req.headers.get('upgrade') ?? '';
      if (upgrade.toLowerCase() !== 'websocket') {
        return new Response(null, {
          status: 426,
          statusText: 'Upgrade Required',
        });
      }

      try {
        const { socket, response } = Deno.upgradeWebSocket(req);

        socket.addEventListener('open', () => {
          onConnection?.(socket);
        });

        socket.addEventListener('message', async (event) => {
          const taskManager = TaskManager.getInstance();
          if (!taskManager) {
            throw new Error('TaskManager not initialized');
          }
          try {
            const raw = typeof event?.data === 'string'
              ? event.data
              : new TextDecoder().decode(event.data as ArrayBuffer);
            const data = JSON.parse(raw);
            taskManager.emit({
              event: data?.event,
              data: data?.data,
              options: data?.options,
            });
          } catch {
            // console.error('Error parsing message:', event.data);
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Error parsing message',
            }));
          }
        });

        return response;
      } catch (err) {
        console.error('ws.gateway upgrade error:', err);
        return new Response(null, { status: 500 });
      }
    },
  );

  return server;
}
