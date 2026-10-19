import * as Clock from "effect/Clock";
import type {
  RelayClientInstallProgressEvent,
  RelayClientInstallProgressStage,
} from "@t3tools/contracts";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Semaphore from "effect/Semaphore";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { HostProcessArchitecture, HostProcessPlatform } from "./hostProcess.ts";
import { runViaOptionalG10S3SharedSeam } from "./g10S3CutoverHook.ts";

export const CLOUDFLARED_VERSION = "2026.5.2";
export const CLOUDFLARED_PATH_ENV_NAME = "T3CODE_CLOUDFLARED_PATH";

/**
 * Context key for optional G9 capture. Must stay identical to server
 * `G9CaptureService` (`apps/server/src/scm/g9OrchQueueCapture.ts`) so
 * Layer.succeed on the server tag is visible here without a shared→server import.
 */
const RELAY_CLIENT_G9_CAPTURE_SERVICE_KEY = "t3/scm/g9OrchQueueCapture/G9CaptureService";

/**
 * Optional live-safe capture shape for relayClient W5c sites.
 *
 * Agent: structural match to server G9CaptureServiceShape.captureOccurrence.
 * Absent service ⇒ resolve / runCommand behave as before (noninterference).
 */
export interface RelayClientG9CaptureShape {
  readonly captureOccurrence: (input: {
    readonly comm_id: string;
    readonly phase: string;
    readonly input: { readonly [key: string]: unknown };
  }) => Effect.Effect<unknown, never>;
}

/**
 * Shared-side Context tag alias for optional G9 capture (WP5-B3-Owner lander).
 *
 * Observed: same key string as server G9CaptureService; Effect.serviceOption
 * resolves either class when the layer is present.
 */
export class RelayClientOptionalG9Capture extends Context.Service<
  RelayClientOptionalG9Capture,
  RelayClientG9CaptureShape
>()(RELAY_CLIENT_G9_CAPTURE_SERVICE_KEY) {}

/**
 * Invoke run only when optional G9 capture is in the environment.
 *
 * Parameters
 * ----------
 * run : (captureOccurrence) => Effect
 *     Builds ledger-bounded A and calls captureOccurrence once.
 */
const whenRelayG9CapturePresent = (
  run: (
    captureOccurrence: RelayClientG9CaptureShape["captureOccurrence"],
  ) => Effect.Effect<unknown, never>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const opt = yield* Effect.serviceOption(RelayClientOptionalG9Capture);
    if (Option.isNone(opt)) return;
    yield* run((input) => opt.value.captureOccurrence(input));
  });

/**
 * INV-T2-FLAG-CLOUDFLARED / flag-resolved A (B2 handoff; member + state only).
 *
 * Agent: mirrors buildFlagCloudflaredResolvedCaptureInput; no path strings in A.
 */
const buildFlagCloudflaredResolvedInput = (state_label: "configured" | "absent") =>
  ({
    comm_id: "INV-T2-FLAG-CLOUDFLARED",
    phase: "flag-resolved",
    input: { member: CLOUDFLARED_PATH_ENV_NAME, state_label },
  }) as const;

/** INV-T2-RELAY-CLIENT spawn A (site only; no command/args). */
const buildCloudflaredSpawnInput = () =>
  ({
    comm_id: "INV-T2-RELAY-CLIENT",
    phase: "cloudflared-spawn-succeeded",
    input: { site: "spawned" },
  }) as const;

/** INV-T2-RELAY-CLIENT exit A (site only; no exitCode number). */
const buildCloudflaredExitInput = () =>
  ({
    comm_id: "INV-T2-RELAY-CLIENT",
    phase: "cloudflared-exit-succeeded",
    input: { site: "exited" },
  }) as const;

export type RelayClientExecutableSource = "override" | "managed" | "path";

export type RelayClientStatus =
  | {
      readonly status: "available";
      readonly executablePath: string;
      readonly source: RelayClientExecutableSource;
      readonly version: string;
    }
  | {
      readonly status: "missing";
      readonly version: string;
    }
  | {
      readonly status: "unsupported";
      readonly platform: NodeJS.Platform;
      readonly arch: string;
      readonly version: string;
    };

export type AvailableRelayClient = Extract<RelayClientStatus, { readonly status: "available" }>;

export class RelayClientInstallError extends Data.TaggedError("RelayClientInstallError")<{
  readonly reason:
    | "download_failed"
    | "invalid_checksum"
    | "install_locked"
    | "override_missing"
    | "unsupported_platform"
    | "validation_failed"
    | "write_failed";
  readonly message: string;
  readonly cause?: unknown;
}> {}

class CloudflaredCommandError extends Data.TaggedError("CloudflaredCommandError")<{
  readonly command: string;
  readonly exitCode: number;
}> {}

export interface CloudflaredReleaseAsset {
  readonly url: string;
  readonly sha256: string;
  readonly archive: "binary" | "tgz";
}

const CLOUDFLARED_RELEASE_ASSETS: Readonly<
  Partial<Record<`${NodeJS.Platform}-${string}`, CloudflaredReleaseAsset>>
> = {
  "darwin-arm64": {
    url: "https://github.com/cloudflare/cloudflared/releases/download/2026.5.2/cloudflared-darwin-arm64.tgz",
    sha256: "ba94054c9fd4297645093d59d51442e5e546d07bb0516120e694a13d5b216d38",
    archive: "tgz",
  },
  "darwin-x64": {
    url: "https://github.com/cloudflare/cloudflared/releases/download/2026.5.2/cloudflared-darwin-amd64.tgz",
    sha256: "7240f709506bc2c1eb9da4d89cf2555499c60280ecb854b7d80e8f17d4b7903d",
    archive: "tgz",
  },
  "linux-arm64": {
    url: "https://github.com/cloudflare/cloudflared/releases/download/2026.5.2/cloudflared-linux-arm64",
    sha256: "5a4e8ce2701105271412059f44b6a0bf1ae4542b4d98ff3180c0c019443a5815",
    archive: "binary",
  },
  "linux-x64": {
    url: "https://github.com/cloudflare/cloudflared/releases/download/2026.5.2/cloudflared-linux-amd64",
    sha256: "5286698547f03df745adb2355f04c12dde52ef425491e81f433642d695521886",
    archive: "binary",
  },
  "win32-x64": {
    url: "https://github.com/cloudflare/cloudflared/releases/download/2026.5.2/cloudflared-windows-amd64.exe",
    sha256: "20b9638f685333d623798e733effbad2487093f15ba592f6c7752360ff3b7ab7",
    archive: "binary",
  },
};

const INSTALL_LOCK_RETRY_COUNT = 100;
const INSTALL_LOCK_RETRY_DELAY = "100 millis";
const INSTALL_LOCK_STALE_MS = 5 * 60 * 1_000;

const trimmedString = (name: string) =>
  Config.string(name).pipe(
    Config.option,
    Config.map(
      Option.flatMap((value) => {
        const trimmed = value.trim();
        return trimmed.length > 0 ? Option.some(trimmed) : Option.none();
      }),
    ),
  );

const CloudflaredConfig = Config.all({
  executableOverride: trimmedString(CLOUDFLARED_PATH_ENV_NAME),
  path: trimmedString("PATH"),
});

export interface CloudflaredRelayClientOptions {
  readonly baseDir: string;
  readonly releaseAsset?: CloudflaredReleaseAsset;
}

export interface RelayClientShape {
  readonly resolve: Effect.Effect<RelayClientStatus>;
  readonly install: Effect.Effect<AvailableRelayClient, RelayClientInstallError>;
  readonly installWithProgress: (
    report: (event: RelayClientInstallProgressEvent) => Effect.Effect<void>,
  ) => Effect.Effect<AvailableRelayClient, RelayClientInstallError>;
}

export class RelayClient extends Context.Service<RelayClient, RelayClientShape>()(
  "@t3tools/shared/relayClient",
) {}

function executableFileName(platform: NodeJS.Platform): string {
  return platform === "win32" ? "cloudflared.exe" : "cloudflared";
}

function resolveReleaseAsset(
  platform: NodeJS.Platform,
  arch: string,
): CloudflaredReleaseAsset | null {
  return CLOUDFLARED_RELEASE_ASSETS[`${platform}-${arch}`] ?? null;
}

function isAlreadyExists(error: PlatformError.PlatformError): boolean {
  return error.reason._tag === "AlreadyExists";
}

const wrapInstallFailure =
  (
    reason: RelayClientInstallError["reason"],
    message: string,
  ): (<E, R>(
    effect: Effect.Effect<void, E, R>,
  ) => Effect.Effect<void, RelayClientInstallError, R>) =>
  (effect) =>
    effect.pipe(
      Effect.mapError(
        (cause) =>
          new RelayClientInstallError({
            reason,
            message,
            cause,
          }),
      ),
    );

export const makeCloudflaredRelayClient = Effect.fn("cloudflared.make")(function* (
  options: CloudflaredRelayClientOptions,
): Effect.fn.Return<
  RelayClientShape,
  never,
  | ChildProcessSpawner.ChildProcessSpawner
  | Crypto.Crypto
  | FileSystem.FileSystem
  | HttpClient.HttpClient
  | Path.Path
> {
  const crypto = yield* Crypto.Crypto;
  const fileSystem = yield* FileSystem.FileSystem;
  const httpClient = yield* HttpClient.HttpClient;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const installSemaphore = yield* Semaphore.make(1);
  const platform = yield* HostProcessPlatform;
  const arch = yield* HostProcessArchitecture;
  const releaseAsset = options.releaseAsset ?? resolveReleaseAsset(platform, arch);
  const loadCloudflaredConfig = Effect.suspend(() => CloudflaredConfig).pipe(Effect.orDie);
  const managedPath = path.join(
    options.baseDir,
    "tools",
    "cloudflared",
    CLOUDFLARED_VERSION,
    `${platform}-${arch}`,
    executableFileName(platform),
  );

  const isExecutableFile = Effect.fn("cloudflared.isExecutableFile")(function* (
    executablePath: string,
  ) {
    const info = yield* fileSystem.stat(executablePath).pipe(Effect.option);
    if (Option.isNone(info) || info.value.type !== "File") return false;
    return platform === "win32" || (info.value.mode & 0o111) !== 0;
  });

  const resolvePathExecutable = Effect.gen(function* () {
    const config = yield* loadCloudflaredConfig;
    const pathValue = Option.getOrUndefined(config.path);
    if (!pathValue) return null;
    const delimiter = platform === "win32" ? ";" : ":";
    for (const directory of pathValue.split(delimiter)) {
      const trimmed = directory.trim().replace(/^"|"$/gu, "");
      if (trimmed.length === 0) continue;
      const candidate = path.join(trimmed, executableFileName(platform));
      if (yield* isExecutableFile(candidate)) return candidate;
    }
    return null;
  });

  const resolve: RelayClientShape["resolve"] = Effect.gen(function* () {
    const config = yield* loadCloudflaredConfig;
    const state_label = Option.isSome(config.executableOverride)
      ? ("configured" as const)
      : ("absent" as const);
    // B2 FLAG-CLOUDFLARED: G9 capture-beside + G10 S8 lander-reopen cutover
    // (S7→S3 handoff; not historical S3 exit (a)). No path strings in A.
    yield* whenRelayG9CapturePresent((captureOccurrence) =>
      captureOccurrence(buildFlagCloudflaredResolvedInput(state_label)),
    );
    const resolved = yield* runViaOptionalG10S3SharedSeam(
      "INV-T2-FLAG-CLOUDFLARED",
      "flag-resolved",
      { member: CLOUDFLARED_PATH_ENV_NAME, state_label },
      Effect.gen(function* () {
        if (Option.isSome(config.executableOverride)) {
          return (yield* isExecutableFile(config.executableOverride.value))
            ? {
                status: "available" as const,
                executablePath: config.executableOverride.value,
                source: "override" as const,
                version: CLOUDFLARED_VERSION,
              }
            : { status: "missing" as const, version: CLOUDFLARED_VERSION };
        }
        if (yield* isExecutableFile(managedPath)) {
          return {
            status: "available" as const,
            executablePath: managedPath,
            source: "managed" as const,
            version: CLOUDFLARED_VERSION,
          };
        }
        const pathExecutable = yield* resolvePathExecutable;
        if (pathExecutable) {
          return {
            status: "available" as const,
            executablePath: pathExecutable,
            source: "path" as const,
            version: CLOUDFLARED_VERSION,
          };
        }
        return releaseAsset
          ? { status: "missing" as const, version: CLOUDFLARED_VERSION }
          : {
              status: "unsupported" as const,
              platform,
              arch,
              version: CLOUDFLARED_VERSION,
            };
      }),
    );
    return resolved;
  });

  const runCommand = Effect.fn("cloudflared.runCommand")(function* (
    command: string,
    args: ReadonlyArray<string>,
  ) {
    // G10 S3 RELAY-CLIENT cutover on spawn/exit. FLAG-CLOUDFLARED resolve is
    // a separate S8 lander-reopen seam (not historical S3 exit (a)).
    const child = yield* runViaOptionalG10S3SharedSeam(
      "INV-T2-RELAY-CLIENT",
      "cloudflared-spawn-succeeded",
      { site: "spawned" },
      Effect.gen(function* () {
        const spawned = yield* spawner.spawn(
          ChildProcess.make(command, args, {
            shell: false,
            stdout: "ignore",
            stderr: "ignore",
          }),
        );
        // RELAY-CLIENT spawn: after spawner.spawn succeeds (no command/args in A).
        yield* whenRelayG9CapturePresent((captureOccurrence) =>
          captureOccurrence(buildCloudflaredSpawnInput()),
        );
        return spawned;
      }),
    );
    const exitCode = Number(yield* child.exitCode);
    if (exitCode !== 0) {
      return yield* new CloudflaredCommandError({ command, exitCode });
    }
    // RELAY-CLIENT exit: observed zero-exit success boundary (no exitCode in A).
    yield* runViaOptionalG10S3SharedSeam(
      "INV-T2-RELAY-CLIENT",
      "cloudflared-exit-succeeded",
      { site: "exited" },
      whenRelayG9CapturePresent((captureOccurrence) =>
        captureOccurrence(buildCloudflaredExitInput()),
      ),
    );
  });

  const downloadAsset = Effect.fn("cloudflared.downloadAsset")(function* (
    asset: CloudflaredReleaseAsset,
    report: (stage: RelayClientInstallProgressStage) => Effect.Effect<void>,
  ) {
    yield* report("downloading");
    const response = yield* httpClient.execute(HttpClientRequest.get(asset.url)).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.mapError(
        (cause) =>
          new RelayClientInstallError({
            reason: "download_failed",
            message: "Could not download the relay client.",
            cause,
          }),
      ),
    );
    const bytes = new Uint8Array(
      yield* response.arrayBuffer.pipe(
        Effect.mapError(
          (cause) =>
            new RelayClientInstallError({
              reason: "download_failed",
              message: "Could not read the downloaded relay client binary.",
              cause,
            }),
        ),
      ),
    );
    yield* report("verifying");
    const checksum = yield* crypto.digest("SHA-256", bytes).pipe(
      Effect.mapError(
        (cause) =>
          new RelayClientInstallError({
            reason: "validation_failed",
            message: "Could not verify the downloaded relay client checksum.",
            cause,
          }),
      ),
    );
    if (Encoding.encodeHex(checksum) !== asset.sha256) {
      return yield* new RelayClientInstallError({
        reason: "invalid_checksum",
        message: "Downloaded relay client checksum did not match the pinned release.",
      });
    }
    return bytes;
  });

  const acquireInstallLock = Effect.fn("cloudflared.acquireInstallLock")(function* (
    lockPath: string,
  ) {
    for (let attempt = 0; attempt < INSTALL_LOCK_RETRY_COUNT; attempt += 1) {
      const acquired = yield* fileSystem.writeFileString(lockPath, "", { flag: "wx" }).pipe(
        Effect.as(true),
        Effect.catch((error) =>
          isAlreadyExists(error) ? Effect.succeed(false) : Effect.fail(error),
        ),
      );
      if (acquired) return;

      const now = yield* Clock.currentTimeMillis;
      const lockInfo = yield* fileSystem.stat(lockPath).pipe(Effect.option);
      const mtime = Option.flatMap(lockInfo, (info) => info.mtime);
      if (Option.isSome(mtime) && now - mtime.value.getTime() > INSTALL_LOCK_STALE_MS) {
        yield* fileSystem.remove(lockPath, { force: true });
        continue;
      }
      yield* Effect.sleep(INSTALL_LOCK_RETRY_DELAY);
    }
    return yield* new RelayClientInstallError({
      reason: "install_locked",
      message: "Another relay client installation is still in progress.",
    });
  });

  const installUnlocked = Effect.fn("cloudflared.installUnlocked")(function* (
    report: (stage: RelayClientInstallProgressStage) => Effect.Effect<void>,
  ) {
    yield* report("checking");
    const existing = yield* resolve;
    if (existing.status === "available") return existing;
    const config = yield* loadCloudflaredConfig;
    if (Option.isSome(config.executableOverride)) {
      return yield* new RelayClientInstallError({
        reason: "override_missing",
        message: `${CLOUDFLARED_PATH_ENV_NAME} does not point to an executable file.`,
      });
    }
    if (!releaseAsset) {
      return yield* new RelayClientInstallError({
        reason: "unsupported_platform",
        message: `T3 Code does not provide a managed relay client binary for ${platform}-${arch}.`,
      });
    }

    const managedDirectory = path.dirname(managedPath);
    const lockPath = `${managedPath}.lock`;
    yield* fileSystem
      .makeDirectory(managedDirectory, { recursive: true })
      .pipe(
        wrapInstallFailure("write_failed", "Could not create the relay client tool directory."),
      );
    yield* report("waiting_for_lock");
    yield* acquireInstallLock(lockPath).pipe(
      Effect.catchTag("PlatformError", (cause) =>
        Effect.fail(
          new RelayClientInstallError({
            reason: "write_failed",
            message: "Could not acquire the relay client installation lock.",
            cause,
          }),
        ),
      ),
    );
    return yield* Effect.gen(function* () {
      const afterLock = yield* resolve;
      if (afterLock.status === "available") return afterLock;

      const tempDirectory = yield* fileSystem.makeTempDirectoryScoped({
        directory: managedDirectory,
        prefix: ".install-",
      });
      const archivePath = path.join(
        tempDirectory,
        releaseAsset.archive === "tgz" ? "cloudflared.tgz" : executableFileName(platform),
      );
      const download = yield* downloadAsset(releaseAsset, report);
      yield* report("installing");
      yield* fileSystem
        .writeFile(archivePath, download)
        .pipe(wrapInstallFailure("write_failed", "Could not write the relay client download."));

      const executablePath = path.join(tempDirectory, executableFileName(platform));
      if (releaseAsset.archive === "tgz") {
        yield* runCommand("tar", ["-xzf", archivePath, "-C", tempDirectory]).pipe(
          wrapInstallFailure("write_failed", "Could not extract the relay client."),
        );
      }
      if (platform !== "win32") {
        yield* fileSystem
          .chmod(executablePath, 0o755)
          .pipe(wrapInstallFailure("write_failed", "Could not make the relay client executable."));
      }
      yield* report("validating");
      yield* runCommand(executablePath, ["--version"]).pipe(
        wrapInstallFailure("validation_failed", "The downloaded relay client binary did not run."),
      );

      const stagedPath = `${managedPath}.${yield* crypto.randomUUIDv4}.tmp`;
      yield* report("activating");
      yield* fileSystem
        .rename(executablePath, stagedPath)
        .pipe(wrapInstallFailure("write_failed", "Could not stage the relay client."));
      yield* fileSystem
        .rename(stagedPath, managedPath)
        .pipe(
          wrapInstallFailure("write_failed", "Could not activate the relay client."),
          Effect.ensuring(fileSystem.remove(stagedPath, { force: true }).pipe(Effect.ignore)),
        );
      return {
        status: "available",
        executablePath: managedPath,
        source: "managed",
        version: CLOUDFLARED_VERSION,
      } satisfies AvailableRelayClient;
    }).pipe(
      Effect.scoped,
      Effect.ensuring(fileSystem.remove(lockPath, { force: true }).pipe(Effect.ignore)),
      Effect.catch((cause) =>
        cause instanceof RelayClientInstallError
          ? Effect.fail(cause)
          : Effect.fail(
              new RelayClientInstallError({
                reason: "write_failed",
                message: "Could not install the relay client.",
                cause,
              }),
            ),
      ),
    );
  });
  const installWithProgress: RelayClientShape["installWithProgress"] = (report) =>
    installSemaphore.withPermit(
      installUnlocked((stage) =>
        report({
          type: "progress",
          stage,
        }),
      ),
    );
  const install = installWithProgress(() => Effect.void);

  return RelayClient.of({ resolve, install, installWithProgress });
});

export const layerCloudflared = (options: CloudflaredRelayClientOptions) =>
  Layer.effect(RelayClient, makeCloudflaredRelayClient(options));
