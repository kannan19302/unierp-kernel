/**
 * @kannan19302/kernel — Test Harness Primitives (P12-022)
 *
 * Provides shared contract fixtures, two-tenant isolation test helpers,
 * deterministic clock control, and fault injection capabilities for platform libraries.
 */

import type { TenantContext } from "./index.js";

/** Controllable virtual clock for deterministic time-based testing */
export class TestClock {
  private currentTime: number;

  constructor(initialDate: Date | string | number = "2026-08-14T00:00:00.000Z") {
    this.currentTime = new Date(initialDate).getTime();
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  nowMs(): number {
    return this.currentTime;
  }

  advance(ms: number): void {
    if (ms < 0) throw new Error("Cannot advance clock backwards.");
    this.currentTime += ms;
  }

  advanceSeconds(seconds: number): void {
    this.advance(seconds * 1000);
  }

  advanceDays(days: number): void {
    this.advance(days * 24 * 60 * 60 * 1000);
  }

  setTime(date: Date | string | number): void {
    this.currentTime = new Date(date).getTime();
  }
}

/** Two-tenant test fixture helper for isolation testing */
export interface TwoTenantFixture {
  tenantA: TenantContext;
  tenantB: TenantContext;
  tenantAId: string;
  tenantBId: string;
}

export function createTwoTenantFixture(prefix = "test"): TwoTenantFixture {
  const tenantAId = `tenant-${prefix}-alpha-${Math.random().toString(36).slice(2, 7)}`;
  const tenantBId = `tenant-${prefix}-beta-${Math.random().toString(36).slice(2, 7)}`;

  return {
    tenantAId,
    tenantBId,
    tenantA: {
      tenantId: tenantAId,
      userId: `user-alpha-1`,
      realm: "tenant",
    },
    tenantB: {
      tenantId: tenantBId,
      userId: `user-beta-1`,
      realm: "tenant",
    },
  };
}

/** Fault injection controller for resilience testing */
export class FaultInjector {
  private faults: Map<string, { failureRate: number; errorFactory: () => Error }> = new Map();

  injectError(targetKey: string, error: Error | (() => Error), failureRate = 1.0): void {
    const errorFactory = typeof error === "function" ? error : () => error;
    this.faults.set(targetKey, { failureRate, errorFactory });
  }

  clear(targetKey?: string): void {
    if (targetKey) {
      this.faults.delete(targetKey);
    } else {
      this.faults.clear();
    }
  }

  maybeThrow(targetKey: string): void {
    const fault = this.faults.get(targetKey);
    if (!fault) return;

    if (Math.random() <= fault.failureRate) {
      throw fault.errorFactory();
    }
  }

  hasFault(targetKey: string): boolean {
    return this.faults.has(targetKey);
  }
}
