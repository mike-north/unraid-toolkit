/**
 * Streamable HTTP transport runner — the primary transport for a hosted Unraid
 * "App". Runs a stateless JSON endpoint at `POST /mcp` plus a `GET /healthz`
 * liveness probe. Validates the `Origin` header (DNS-rebinding protection) and
 * optionally enforces a bearer token, since this transport is network-exposed.
 */

import express, { type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpConfig } from '../config.js';
import type { Logger } from '../log.js';

/** Factory that produces a fresh server instance per request (stateless mode). */
export type ServerFactory = () => McpServer;

const JSONRPC_AUTH_ERROR = {
  jsonrpc: '2.0' as const,
  error: { code: -32001, message: 'Unauthorized' },
  id: null,
};

const JSONRPC_ORIGIN_ERROR = {
  jsonrpc: '2.0' as const,
  error: { code: -32001, message: 'Forbidden: cross-origin request rejected' },
  id: null,
};

/**
 * Start the Streamable HTTP transport server.
 *
 * @returns A function that gracefully closes the HTTP server.
 */
export async function startHttp(
  serverFactory: ServerFactory,
  config: McpConfig,
  logger: Logger,
): Promise<() => Promise<void>> {
  const app = express();
  app.use(express.json());

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/mcp', (req: Request, res: Response) => {
    void handleMcpRequest(req, res, serverFactory, config, logger);
  });

  return new Promise<() => Promise<void>>((resolve) => {
    const httpServer = app.listen(config.httpPort, () => {
      logger.info(`MCP server listening on http://0.0.0.0:${String(config.httpPort)}/mcp`);
      resolve(
        () =>
          new Promise<void>((res, rej) => {
            httpServer.close((err) => {
              if (err) rej(err);
              else res();
            });
          }),
      );
    });
  });
}

async function handleMcpRequest(
  req: Request,
  res: Response,
  serverFactory: ServerFactory,
  config: McpConfig,
  logger: Logger,
): Promise<void> {
  // DNS-rebinding protection: reject any request carrying a browser Origin.
  // Legitimate MCP clients connect server-to-server and omit Origin.
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    res.status(403).json(JSONRPC_ORIGIN_ERROR);
    return;
  }

  if (config.httpAuthToken !== undefined && !hasValidBearer(req, config.httpAuthToken)) {
    res.status(401).json(JSONRPC_AUTH_ERROR);
    return;
  }

  // Stateless: a fresh server + transport per request avoids cross-request
  // state and request-ID collisions.
  const server = serverFactory();
  const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error('Error handling MCP request', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

/** Check for a matching `Authorization: Bearer <token>` header. */
function hasValidBearer(req: Request, expected: string): boolean {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return false;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] === expected;
}
