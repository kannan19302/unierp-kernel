/**
 * @kannan19302/kernel — governor primitives (A19).
 *
 * The canonical, dependency-free definition of per-tenant resource budgets —
 * "governor limits", the Salesforce analogue. Sandbox (L2) and api (L3) each
 * consume this once published; until then they carry structurally-compatible
 * implementations behind a `TenantGovernor` interface (see FOUND in the A19
 * record). Pure logic: no I/O, no timers beyond Date.now, no platform imports.
 */

/** The budgets a tenant is held to in one window. */
export interface GovernorLimits {
  /** Window length in ms. All other budgets reset when it rolls over. */
  windowMs: number;
  /** Total real CPU (ms) the tenant may burn across all its code in a window. */
  cpuMsPerWindow: number;
  /** Total wall-clock (ms) across all of the tenant's invocations in a window. */
  wallMsPerWindow: number;
  /** Total database queries the tenant may issue in a window. */
  queriesPerWindow: number;
  /** Total rows the tenant may read or write in a window. */
  rowsPerWindow: number;
  /** Total egress bytes (outbound HTTP request+response) in a window. */
  egressBytesPerWindow: number;
}

/** One resource a tenant may be cut off on. */
export type GovernorBudgetKey = keyof GovernorLimits;

/** A charge against a tenant's budget. Fields not set are zero. */
export interface GovernorCharge {
  cpuMs?: number;
  wallMs?: number;
  queries?: number;
  rows?: number;
  egressBytes?: number;
}

/** A governor rejection, emitted so the caller can audit it. */
export interface GovernorEvent {
  tenantId: string;
  extensionId: string;
  budget: Exclude<GovernorBudgetKey, "windowMs">;
  /** The budget value that was exceeded. */
  limit: number;
  /** The tenant's cumulative consumption when it was cut off. */
  used: number;
  /** ISO timestamp. */
  at: string;
}

/** Thrown when a tenant exceeds a governor limit. Carries the auditable event. */
export class GovernorLimitError extends Error {
  readonly event: GovernorEvent;
  constructor(event: GovernorEvent) {
    super(
      `Tenant "${event.tenantId}" exceeded its ${event.budget} governor limit ` +
        `(used ${event.used} of ${event.limit}) during ${event.extensionId}.`,
    );
    this.name = "GovernorLimitError";
    this.event = event;
  }
}

/** One tenant's rolling accounting. Fixed window, reset on rollover. */
interface TenantWindow {
  start: number;
  used: Record<GovernorBudgetKey, number>;
}

const ZERO = (): Record<GovernorBudgetKey, number> => ({
  windowMs: 0,
  cpuMsPerWindow: 0,
  wallMsPerWindow: 0,
  queriesPerWindow: 0,
  rowsPerWindow: 0,
  egressBytesPerWindow: 0,
});

const DELTA_KEYS: Array<Exclude<GovernorBudgetKey, "windowMs">> = [
  "cpuMsPerWindow",
  "wallMsPerWindow",
  "queriesPerWindow",
  "rowsPerWindow",
  "egressBytesPerWindow",
];

/**
 * Per-tenant budget accounting. `charge()` accumulates the deltas against the
 * tenant's window and throws `GovernorLimitError` (emitting the event first) on
 * the first budget that would be exceeded. Isolation is structural: the map is
 * keyed by tenantId, so charging tenant-a never affects tenant-b.
 */
export class TenantGovernor {
  private readonly windows = new Map<string, TenantWindow>();
  constructor(
    private readonly onEvent?: (event: GovernorEvent) => void,
  ) {}

  charge(
    tenantId: string,
    extensionId: string,
    charge: GovernorCharge,
    limits: GovernorLimits,
  ): void {
    let window = this.windows.get(tenantId);
    if (!window) {
      window = { start: Date.now(), used: ZERO() };
      this.windows.set(tenantId, window);
    }
    const now = Date.now();
    if (now - window.start >= limits.windowMs) {
      window.start = now;
      window.used = ZERO();
    }
    if (charge.cpuMs) window.used.cpuMsPerWindow += charge.cpuMs;
    if (charge.wallMs) window.used.wallMsPerWindow += charge.wallMs;
    if (charge.queries) window.used.queriesPerWindow += charge.queries;
    if (charge.rows) window.used.rowsPerWindow += charge.rows;
    if (charge.egressBytes) window.used.egressBytesPerWindow += charge.egressBytes;

    for (const key of DELTA_KEYS) {
      if (window.used[key] > limits[key]) {
        const event: GovernorEvent = {
          tenantId,
          extensionId,
          budget: key,
          limit: limits[key],
          used: window.used[key],
          at: new Date().toISOString(),
        };
        this.onEvent?.(event);
        throw new GovernorLimitError(event);
      }
    }
  }

  /** Current consumption for a tenant (for tests and monitoring). */
  snapshot(tenantId: string): Record<GovernorBudgetKey, number> | undefined {
    const window = this.windows.get(tenantId);
    return window ? { ...window.used } : undefined;
  }

  /** Clear a tenant's accounting (used when a tenant is deactivated). */
  reset(tenantId: string): void {
    this.windows.delete(tenantId);
  }
}
