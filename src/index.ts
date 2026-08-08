/**
 * @kannan19302/kernel — L1. Primitives every plane shares.
 * Depends only on @kannan19302/contracts (L0).
 * See PLATFORM_ARCHITECTURE.md § 4.2.
 */

/** Tenant context bound to the current execution scope */
export interface TenantContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  realm: "tenant" | "control-plane" | "machine";
}

/** Single decision point for RBAC and future ABAC */
export class PolicyEngine {
  private static readonly CONTROL_PLANE_NAMESPACES = [
    "system",
    "platform",
  ] as const;

  static isControlPlane(permission: string): boolean {
    return this.CONTROL_PLANE_NAMESPACES.some((ns) =>
      permission.startsWith(ns + "."),
    );
  }

  static hasPermission(grants: string[], required: string): boolean {
    if (this.isControlPlane(required)) {
      // Control-plane permission only satisfied by explicit control-plane grant
      return grants.some(
        (g) => g === required || (this.isControlPlane(g) && g === required),
      );
    }
    return grants.some((g) => {
      if (g === "*") return false; // wildcard does NOT satisfy control-plane — tenant wildcard only
      if (g.endsWith(".*")) return required.startsWith(g.slice(0, -1));
      return g === required;
    });
  }
}

/** Idempotency key utilities */
export function makeIdempotencyKey(namespace: string, id: string): string {
  return `${namespace}:${id}`;
}

/** Outbox event envelope */
export interface OutboxEvent {
  id: string;
  tenantId: string;
  eventType: string;
  payload: unknown;
  publishedAt?: Date;
  retries: number;
}

export {
  TenantGovernor,
  GovernorLimitError,
  type GovernorLimits,
  type GovernorBudgetKey,
  type GovernorCharge,
  type GovernorEvent,
} from "./governor";
