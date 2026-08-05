# unierp-kernel

**Layer L1** of the UniERP layered repository architecture
(`PLATFORM_ARCHITECTURE.md` § 4.2). Publishes `@unerp/kernel`.

Depends on: L0 (`@unerp/contracts`).

## What lives here

Tenancy context, `PolicyEngine`, audit, outbox, idempotency, rate limiting, versioning, observability — the primitives every plane shares.

## The invariant

The kernel may depend on L0 and nothing else in the workspace. It is imported by the service layer, the frontends and by extensions, so a dependency added here is a dependency added to everything.

**A repository may depend only on published artifacts of a strictly lower
layer. Never sideways within a layer. Never upward.** A cycle is not
discouraged here — it is unrepresentable, because the lower layer's package
cannot name the higher one.

## Extraction status

Extracted from the `ERPSys` monorepo as § 14 Phase 3.2.

**The monorepo copy is still authoritative.** Per § 14, consumers switch to the
published package only once that package is publishable, and the monorepo stays
buildable at each extraction tag until they do. Until a registry is available
this repository is the extraction target, not the source of truth.

Rollback is a one-line `pnpm` override pointing consumers back at the
workspace path.
