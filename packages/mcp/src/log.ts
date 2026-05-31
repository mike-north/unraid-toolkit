/**
 * Minimal leveled logger that writes exclusively to **stderr**.
 *
 * Critical for the stdio transport: stdout carries the MCP JSON-RPC stream, so
 * all diagnostic logging must go to stderr to avoid corrupting it.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function formatLine(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const base = `[unraid-mcp] ${level.toUpperCase()} ${message}`;
  return meta && Object.keys(meta).length > 0 ? `${base} ${JSON.stringify(meta)}` : base;
}

/** Create a logger that emits messages at or above `minLevel` to stderr. */
export function createLogger(minLevel: LogLevel = 'info'): Logger {
  const threshold = LEVEL_RANK[minLevel];
  function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_RANK[level] < threshold) return;
    process.stderr.write(`${formatLine(level, message, meta)}\n`);
  }
  return {
    debug: (message, meta) => {
      emit('debug', message, meta);
    },
    info: (message, meta) => {
      emit('info', message, meta);
    },
    warn: (message, meta) => {
      emit('warn', message, meta);
    },
    error: (message, meta) => {
      emit('error', message, meta);
    },
  };
}
