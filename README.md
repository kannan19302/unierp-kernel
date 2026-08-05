# unierp-kernel

**Layer L1 — Foundation** of the [UniERP](../unierp-platform) platform.
Depends on: L0.

## What this is

Tenancy context, the policy engine, audit, the transactional outbox, idempotency, rate limiting and observability — the primitives every plane shares.

## The invariant this repository owns

Imported by the service layer, the frontends and by extensions, so a dependency added here is a dependency added to everything.

## The rule that applies everywhere

A repository may depend only on published artifacts of a **strictly lower
layer** — never sideways within a layer, never upward. A cycle is not
discouraged; it is unrepresentable, because the lower layer's package cannot
name the higher one.

See the [platform overview](../unierp-platform/README.md) for the full map, and
[`PLATFORM_ARCHITECTURE.md`](../ERPSys/docs/PLATFORM_ARCHITECTURE.md) § 4.2 for
the reasoning.

## Licence

AGPL-3.0.
