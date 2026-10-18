/**
 * Codex launch-arg resolution (env T3CODE_CODEX_LAUNCH_ARGS vs settings).
 *
 * Intended: tokenize shared flags for app-server and exec paths without inventing
 * new env parsing. G9 W5c (B4 lander): resolveCodexLaunchArgsCaptured captures
 * INV-T2-FLAG-CODEX-LAUNCH / flag-resolved once per successful resolution when
 * G9CaptureService is present (configured|absent). Sync resolveCodexLaunchArgs
 * stays for non-Effect callers; presence/shape only in equality A.
 */
import { tokenizeCliArgs } from "@t3tools/shared/cliArgs";
import * as Effect from "effect/Effect";

import { captureFlagCodexLaunchResolved } from "../../scm/g9FamilyFileDbProcessConfig.ts";
import { captureWhenG9Present } from "../../scm/g9FamilyProviderProtocol.ts";

export const T3CODE_CODEX_LAUNCH_ARGS_ENV = "T3CODE_CODEX_LAUNCH_ARGS";

/** Sync resolve: env wins when non-empty trimmed; else launchArgs; else "". */
export const resolveCodexLaunchArgs = (
  launchArgs?: string,
  environment: NodeJS.ProcessEnv = process.env,
) => environment[T3CODE_CODEX_LAUNCH_ARGS_ENV]?.trim() || launchArgs?.trim() || "";

/**
 * Effect resolve + optional FLAG-CODEX-LAUNCH capture at the declared site.
 *
 * Agent: one success → one capture. state_label configured when resolved string
 * is non-empty; absent otherwise. Does not parse argv into A.
 */
export const resolveCodexLaunchArgsCaptured = Effect.fn("resolveCodexLaunchArgsCaptured")(
  function* (launchArgs?: string, environment: NodeJS.ProcessEnv = process.env) {
    const resolved = resolveCodexLaunchArgs(launchArgs, environment);
    const state_label = resolved.length > 0 ? ("configured" as const) : ("absent" as const);
    yield* captureWhenG9Present((capture) => captureFlagCodexLaunchResolved(state_label, capture));
    return resolved;
  },
);

export const codexLaunchArgv = (launchArgs?: string): ReadonlyArray<string> =>
  tokenizeCliArgs(launchArgs);

export const codexAppServerArgs = (launchArgs?: string) => [
  "app-server",
  ...codexLaunchArgv(launchArgs),
];

export const codexExecLaunchArgs = (launchArgs?: string) => {
  const args = codexLaunchArgv(launchArgs);
  const execArgs: Array<string> = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === undefined) continue;

    if (arg === "--strict-config" || arg.startsWith("--config=") || arg.startsWith("-c=")) {
      execArgs.push(arg);
    } else if (arg === "--config" || arg === "-c" || arg === "--enable" || arg === "--disable") {
      const value = args[index + 1];
      if (value !== undefined && !value.startsWith("-")) {
        execArgs.push(arg, value);
        index++;
      }
    } else if (arg.startsWith("--enable=") || arg.startsWith("--disable=")) {
      execArgs.push(arg);
    }
  }

  return execArgs;
};

export const codexSessionAppServerArgs = (
  appServerArgs: ReadonlyArray<string> | undefined,
  launchArgs: string | undefined,
) => {
  const launchAppServerArgs = codexAppServerArgs(launchArgs);
  return appServerArgs ? [...launchAppServerArgs, ...appServerArgs] : launchAppServerArgs;
};
