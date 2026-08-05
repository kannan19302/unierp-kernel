#!/usr/bin/env node
// Layering gate — PLATFORM_ARCHITECTURE.md § 4.2.
//
// This repository may depend only on published artifacts of a STRICTLY LOWER
// layer. Never sideways within a layer. Never upward. The check is deliberately
// dumb and total: it reads package.json rather than trying to be clever about
// imports, because the dependency declaration is what a consumer actually
// resolves.
import { readFileSync } from "node:fs";

const ALLOWED = new Set(["@unerp/contracts"]);
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const declared = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
].filter((d) => d.startsWith("@unerp/") || d.startsWith("@unierp/"));

const violations = declared.filter((d) => !ALLOWED.has(d));

if (violations.length) {
  console.error(
    "Layering violation — this repository declares a workspace dependency it may not have:",
  );
  for (const v of violations) console.error("  · " + v);
  console.error(
    "\nPermitted: " + (ALLOWED.size ? [...ALLOWED].join(", ") : "(none — this layer depends on nothing)"),
  );
  console.error(
    "PLATFORM_ARCHITECTURE.md § 4.2: a repository may depend only on published artifacts",
  );
  console.error("of a strictly lower layer. Never sideways. Never upward. No exceptions.");
  process.exit(1);
}

console.log(
  "Layering OK — " +
    (declared.length ? declared.join(", ") : "no workspace dependencies") +
    ".",
);
