// @effect-diagnostics nodeBuiltinImport:off
/**
 * G7 halt/freeze package loaders only. Not a campaign class and not an
 * SCM identity. Freeze/halt live on DipMuteStore (g6DipMute.ts). This
 * file checks docs/scm/g7/manifest.json completeness: legal tuple, gate
 * G7, later-gates locked. No independent-review hash. Does not flip
 * G4/G5 g6toG10Authorized or G6 g7toG10Authorized and does not
 * authorize G8–G10.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const MANIFEST_STATUSES = new Set(["authorized", "in-progress", "completed"]);

export interface G7Authorization {
  identity: string;
  scope: string;
  note: string;
}

/**
 * G7 halt/freeze package manifest. No review hash field: completed means
 * proof-matrix package completeness, not independent Codex review or A7.
 */
export interface G7Manifest {
  schemaVersion: 1;
  gate: "G7";
  status: "authorized" | "in-progress" | "completed";
  authorized: boolean;
  completed: boolean;
  doesNotAuthorizeLaterGates: true;
  g8toG10Authorized: false;
  plan: string;
  authorization: G7Authorization;
}

export interface G7Package {
  repoRoot: string;
  manifest: G7Manifest;
}

export interface G7Failure {
  readonly code: string;
  readonly message: string;
}

export type G7CheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: ReadonlyArray<G7Failure> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Legal (status, authorized, completed) combinations for G7.
 *
 * Parameters
 * ----------
 * manifest : G7Manifest
 *     Parsed G7 manifest.
 *
 * Returns
 * -------
 * boolean
 *     True when the tuple matches authorized/in-progress vs completed.
 *
 * Example
 * -------
 * legalManifestTuple(pkg.manifest)
 */
const legalManifestTuple = (manifest: G7Manifest): boolean => {
  if (!MANIFEST_STATUSES.has(manifest.status)) {
    return false;
  }
  if (manifest.status === "authorized" || manifest.status === "in-progress") {
    return manifest.authorized === true && manifest.completed === false;
  }
  return manifest.authorized === true && manifest.completed === true;
};

/**
 * Load the G7 halt/freeze package.
 *
 * Parameters
 * ----------
 * repoRoot : string
 *     T2-SQUARED repository root.
 *
 * Returns
 * -------
 * G7Package
 *     Manifest only. README is explanatory and is not a reviewed digest.
 *
 * Example
 * -------
 * const pkg = loadG7Package(repoRoot);
 */
export const loadG7Package = (repoRoot: string): G7Package => ({
  repoRoot,
  manifest: JSON.parse(
    NodeFS.readFileSync(NodePath.join(repoRoot, "docs/scm/g7/manifest.json"), "utf8"),
  ) as G7Manifest,
});

/**
 * Check G7 halt/freeze package completeness.
 *
 * Legal tuple, gate G7, and later-gate barrier only. Completed does not
 * require an independent review hash. G8–G10 stay locked.
 *
 * Parameters
 * ----------
 * pkg : G7Package
 *     Loaded G7 package.
 *
 * Returns
 * -------
 * G7CheckResult
 *     `ok: true` when the legal tuple and later-gate barrier hold.
 *
 * Example
 * -------
 * const result = checkG7(loadG7Package(repoRoot));
 */
export const checkG7 = (pkg: G7Package): G7CheckResult => {
  const failures: G7Failure[] = [];
  const push = (code: string, message: string) => {
    failures.push({ code, message });
  };
  if (!isRecord(pkg.manifest) || pkg.manifest.gate !== "G7") {
    push("manifest-gate", "expected G7 package");
  }
  if (!legalManifestTuple(pkg.manifest)) {
    push(
      "manifest-tuple",
      `illegal tuple status=${pkg.manifest.status} authorized=${String(pkg.manifest.authorized)} completed=${String(pkg.manifest.completed)}`,
    );
  }
  if (!pkg.manifest.doesNotAuthorizeLaterGates || pkg.manifest.g8toG10Authorized) {
    push("later-gates", "G7 must keep doesNotAuthorizeLaterGates true and g8toG10Authorized false");
  }
  if (failures.length > 0) {
    return { ok: false, failures };
  }
  return { ok: true };
};
