/**
 * @kannan19302/kernel — Structured Logging Standard
 *
 * P12-014: One logging contract every service uses, with correlation propagation.
 * Ensures consistent JSON structured logging, tenant context isolation, traceId/spanId/correlationId propagation.
 */

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  traceId?: string;
  spanId?: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  service?: string;
  module?: string;
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context?: Record<string, unknown>;
}

export interface Logger {
  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void;
  fatal(message: string, error?: Error | unknown, context?: Record<string, unknown>): void;
  child(bindings: LogContext): Logger;
}

export class StandardStructuredLogger implements Logger {
  private readonly defaultContext: LogContext;
  private readonly writer: (entry: StructuredLogEntry) => void;

  constructor(
    defaultContext: LogContext = {},
    writer: (entry: StructuredLogEntry) => void = (e) => {
      if (typeof console !== "undefined" && console.log) {
        console.log(JSON.stringify(e));
      }
    }
  ) {
    this.defaultContext = {
      service: "unierp-service",
      ...defaultContext,
    };
    this.writer = writer;
  }

  private emit(level: LogLevel, message: string, err?: Error | unknown, extra?: Record<string, unknown>): void {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: (this.defaultContext.service as string) || "unierp-service",
      correlationId: this.defaultContext.correlationId,
      traceId: this.defaultContext.traceId,
      spanId: this.defaultContext.spanId,
      tenantId: this.defaultContext.tenantId,
      userId: this.defaultContext.userId,
    };

    if (err instanceof Error) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: (err as unknown as { code?: string }).code,
      };
    } else if (err && typeof err === "object") {
      entry.context = { ...entry.context, errorDetails: err };
    }

    if (extra && Object.keys(extra).length > 0) {
      entry.context = { ...entry.context, ...extra };
    }

    this.writer(entry);
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.emit("trace", message, undefined, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit("debug", message, undefined, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.emit("info", message, undefined, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.emit("warn", message, undefined, context);
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    this.emit("error", message, error, context);
  }

  fatal(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    this.emit("fatal", message, error, context);
  }

  child(bindings: LogContext): Logger {
    return new StandardStructuredLogger({ ...this.defaultContext, ...bindings }, this.writer);
  }
}

export function createStructuredLogger(context: LogContext = {}, writer?: (entry: StructuredLogEntry) => void): Logger {
  return new StandardStructuredLogger(context, writer);
}
