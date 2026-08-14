import { describe, it, expect } from "vitest";
import { TestClock, createTwoTenantFixture, FaultInjector } from "./test-harness.js";

describe("Test Harness (P12-022)", () => {
  describe("TestClock", () => {
    it("controls time deterministically", () => {
      const clock = new TestClock("2026-08-14T12:00:00.000Z");
      expect(clock.now().toISOString()).toBe("2026-08-14T12:00:00.000Z");

      clock.advanceSeconds(30);
      expect(clock.now().toISOString()).toBe("2026-08-14T12:00:30.000Z");

      clock.advanceDays(1);
      expect(clock.now().toISOString()).toBe("2026-08-15T12:00:30.000Z");
    });

    it("rejects negative time advancement", () => {
      const clock = new TestClock();
      expect(() => clock.advance(-100)).toThrow("Cannot advance clock backwards.");
    });
  });

  describe("TwoTenantFixture", () => {
    it("creates isolated tenant contexts with distinct tenantIds", () => {
      const fixture = createTwoTenantFixture("billing");
      expect(fixture.tenantAId).not.toBe(fixture.tenantBId);
      expect(fixture.tenantA.tenantId).toBe(fixture.tenantAId);
      expect(fixture.tenantB.tenantId).toBe(fixture.tenantBId);
      expect(fixture.tenantA.realm).toBe("tenant");
      expect(fixture.tenantB.realm).toBe("tenant");
    });
  });

  describe("FaultInjector", () => {
    it("injects simulated faults deterministically", () => {
      const injector = new FaultInjector();
      const dbQueryKey = "database:query:findUser";

      expect(() => injector.maybeThrow(dbQueryKey)).not.toThrow();

      injector.injectError(dbQueryKey, new Error("Simulated connection timeout"), 1.0);
      expect(() => injector.maybeThrow(dbQueryKey)).toThrow("Simulated connection timeout");

      injector.clear(dbQueryKey);
      expect(() => injector.maybeThrow(dbQueryKey)).not.toThrow();
    });
  });
});
