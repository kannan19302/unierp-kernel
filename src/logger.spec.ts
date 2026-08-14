import { describe, it, expect } from "vitest";
import { createStructuredLogger, StandardStructuredLogger, type StructuredLogEntry } from "./logger";

describe("Structured Logging Standard (P12-014)", () => {
  it("emits compliant JSON structured log entries with timestamp, level, service and message", () => {
    const logs: StructuredLogEntry[] = [];
    const logger = createStructuredLogger({ service: "test-service", tenantId: "tenant-123" }, (entry) => {
      logs.push(entry);
    });

    logger.info("Order processed successfully", { orderId: "ord-99" });

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("info");
    expect(logs[0].service).toBe("test-service");
    expect(logs[0].tenantId).toBe("tenant-123");
    expect(logs[0].message).toBe("Order processed successfully");
    expect(logs[0].context).toEqual({ orderId: "ord-99" });
    expect(logs[0].timestamp).toBeDefined();
  });

  it("propagates correlationId and traceId across child logger contexts", () => {
    const logs: StructuredLogEntry[] = [];
    const rootLogger = createStructuredLogger({ service: "gateway", traceId: "trace-abc", correlationId: "corr-123" }, (entry) => {
      logs.push(entry);
    });

    const downstreamLogger = rootLogger.child({ service: "order-service", tenantId: "tenant-456", spanId: "span-001" });
    downstreamLogger.warn("Payment retry initiated", { attempt: 2 });

    expect(logs).toHaveLength(1);
    expect(logs[0].traceId).toBe("trace-abc");
    expect(logs[0].correlationId).toBe("corr-123");
    expect(logs[0].spanId).toBe("span-001");
    expect(logs[0].service).toBe("order-service");
    expect(logs[0].tenantId).toBe("tenant-456");
    expect(logs[0].level).toBe("warn");
  });

  it("formats Error instances with name, message, stack and error codes", () => {
    const logs: StructuredLogEntry[] = [];
    const logger = createStructuredLogger({ service: "billing" }, (e) => logs.push(e));

    const err = new Error("Database timeout");
    (err as unknown as { code: string }).code = "ERR_TIMEOUT";

    logger.error("Transaction failed", err, { invoiceId: "inv-100" });

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("error");
    expect(logs[0].error?.name).toBe("Error");
    expect(logs[0].error?.message).toBe("Database timeout");
    expect(logs[0].error?.code).toBe("ERR_TIMEOUT");
    expect(logs[0].error?.stack).toBeDefined();
    expect(logs[0].context).toEqual({ invoiceId: "inv-100" });
  });
});
