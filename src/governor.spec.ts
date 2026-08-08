import { describe, expect, it, vi } from "vitest";
import { GovernorLimitError, TenantGovernor, type GovernorLimits } from "./governor";

const LIMITS: GovernorLimits = {
  windowMs: 60_000,
  cpuMsPerWindow: 100,
  wallMsPerWindow: 60_000,
  queriesPerWindow: 1_000,
  rowsPerWindow: 10_000,
  egressBytesPerWindow: 1_048_576,
};

describe("TenantGovernor", () => {
  it("accumulates charges and throws GovernorLimitError when a budget is exceeded", () => {
    const governor = new TenantGovernor();
    governor.charge("tenant-a", "acme-widget", { cpuMs: 40 }, LIMITS);
    governor.charge("tenant-a", "acme-widget", { cpuMs: 40 }, LIMITS);
    expect(() =>
      governor.charge("tenant-a", "acme-widget", { cpuMs: 40 }, LIMITS),
    ).toThrow(GovernorLimitError);
  });

  it("emits the GovernorEvent before throwing, with limit and used values", () => {
    const onEvent = vi.fn();
    const governor = new TenantGovernor(onEvent);
    governor.charge("tenant-a", "acme-widget", { cpuMs: 100 }, LIMITS);
    expect(() =>
      governor.charge("tenant-a", "acme-widget", { cpuMs: 1 }, LIMITS),
    ).toThrow(GovernorLimitError);
    expect(onEvent).toHaveBeenCalledTimes(1);
    const event = onEvent.mock.calls[0][0];
    expect(event.tenantId).toBe("tenant-a");
    expect(event.extensionId).toBe("acme-widget");
    expect(event.budget).toBe("cpuMsPerWindow");
    expect(event.limit).toBe(100);
    expect(event.used).toBeGreaterThan(100);
    expect(event.at).toEqual(expect.any(String));
  });

  it("keeps a tenant's overage isolated from other tenants", () => {
    const onEvent = vi.fn();
    const governor = new TenantGovernor(onEvent);
    let cutOff = false;
    try {
      for (let i = 0; i < 10; i++) {
        governor.charge("tenant-a", "acme-widget", { cpuMs: 30 }, LIMITS);
      }
    } catch (error) {
      expect(error).toBeInstanceOf(GovernorLimitError);
      cutOff = true;
    }
    expect(cutOff).toBe(true);
    expect(onEvent).toHaveBeenCalled();
    expect(() =>
      governor.charge("tenant-b", "other-widget", { cpuMs: 30 }, LIMITS),
    ).not.toThrow();
    expect(governor.snapshot("tenant-a")).toBeDefined();
    expect(governor.snapshot("tenant-b")?.cpuMsPerWindow).toBe(30);
  });

  it("tracks budgets independently and names the exceeded budget in the event", () => {
    const governor = new TenantGovernor();
    governor.charge("tenant-a", "acme-widget", { cpuMs: 50 }, LIMITS);
    governor.charge("tenant-a", "acme-widget", { queries: 500 }, LIMITS);
    governor.charge("tenant-a", "acme-widget", { wallMs: 1_000 }, LIMITS);
    let error: unknown;
    try {
      governor.charge("tenant-a", "acme-widget", { queries: 600 }, LIMITS);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(GovernorLimitError);
    const event = (error as GovernorLimitError).event;
    expect(event.budget).toBe("queriesPerWindow");
    expect(event.limit).toBe(1_000);
  });

  it("stays cut off for the window once a budget is exceeded, until rollover", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const governor = new TenantGovernor();
    for (let i = 0; i < 5; i++) {
      try {
        governor.charge("tenant-a", "acme-widget", { cpuMs: 30 }, LIMITS);
      } catch {
        // thrown once the window crosses the cpuMsPerWindow limit
      }
    }
    expect(() =>
      governor.charge("tenant-a", "acme-widget", { cpuMs: 1 }, LIMITS),
    ).toThrow(GovernorLimitError);

    vi.advanceTimersByTime(60_001);
    expect(() =>
      governor.charge("tenant-a", "acme-widget", { cpuMs: 20 }, LIMITS),
    ).not.toThrow();
    vi.useRealTimers();
  });

  it("reset() clears a tenant's accounting", () => {
    const governor = new TenantGovernor();
    for (let i = 0; i < 10; i++) {
      try {
        governor.charge("tenant-a", "acme-widget", { cpuMs: 30 }, LIMITS);
      } catch {
        // cut off partway through the loop
      }
    }
    expect(() =>
      governor.charge("tenant-a", "acme-widget", { cpuMs: 1 }, LIMITS),
    ).toThrow(GovernorLimitError);
    governor.reset("tenant-a");
    expect(governor.snapshot("tenant-a")).toBeUndefined();
    expect(() =>
      governor.charge("tenant-a", "acme-widget", { cpuMs: 30 }, LIMITS),
    ).not.toThrow();
  });
});
