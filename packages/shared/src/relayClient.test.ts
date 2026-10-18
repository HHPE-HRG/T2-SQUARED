import { sha256 } from "@noble/hashes/sha2";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { HostProcessArchitecture, HostProcessPlatform } from "./hostProcess.ts";

import {
  CLOUDFLARED_PATH_ENV_NAME,
  CLOUDFLARED_VERSION,
  RelayClientInstallError,
  RelayClientOptionalG9Capture,
  makeCloudflaredRelayClient,
} from "./relayClient.ts";

const hostRuntimeLayer = (env: Record<string, string> = {}) =>
  Layer.mergeAll(
    Layer.succeed(HostProcessPlatform, "linux"),
    Layer.succeed(HostProcessArchitecture, "x64"),
    ConfigProvider.layer(ConfigProvider.fromEnv({ env })),
  );

function makeHandle(exitCode = 0) {
  return ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(100),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: Stream.empty,
    stderr: Stream.empty,
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });
}

const makeHttpClientLayer = (bytes: Uint8Array) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response(bytes.buffer as ArrayBuffer)),
      ),
    ),
  );

const makeSpawnerLayer = (commands: Array<string>) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) =>
      Effect.sync(() => {
        commands.push(ChildProcess.isStandardCommand(command) ? command.command : "piped-command");
        return makeHandle();
      }),
    ),
  );

describe("RelayClient", () => {
  it.effect("resolves explicit overrides before managed and PATH executables", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-cloudflared-test-",
      });
      const overridePath = `${baseDir}/override-cloudflared`;
      yield* fileSystem.writeFileString(overridePath, "override");
      yield* fileSystem.chmod(overridePath, 0o755);
      const manager = yield* makeCloudflaredRelayClient({
        baseDir,
      });

      expect(
        yield* manager.resolve.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: { PATH: "", T3CODE_CLOUDFLARED_PATH: overridePath },
            }),
          ),
        ),
      ).toEqual({
        status: "available",
        executablePath: overridePath,
        source: "override",
        version: CLOUDFLARED_VERSION,
      });
    }).pipe(
      Effect.scoped,
      Effect.provide(
        Layer.mergeAll(
          NodeServices.layer,
          makeHttpClientLayer(new Uint8Array()),
          makeSpawnerLayer([]),
          hostRuntimeLayer(),
        ),
      ),
    ),
  );

  it.effect("downloads, verifies, validates, and atomically installs the managed executable", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-cloudflared-test-",
      });
      const bytes = new TextEncoder().encode("test-cloudflared-binary");
      const manager = yield* makeCloudflaredRelayClient({
        baseDir,
        releaseAsset: {
          url: "https://example.test/cloudflared",
          sha256: Encoding.encodeHex(sha256(bytes)),
          archive: "binary",
        },
      });

      const progress: Array<string> = [];
      const installed = yield* manager.installWithProgress((event) =>
        Effect.sync(() => {
          if (event.type === "progress") {
            progress.push(event.stage);
          }
        }),
      );
      const managedPath = `${baseDir}/tools/cloudflared/${CLOUDFLARED_VERSION}/linux-x64/cloudflared`;
      expect(installed).toEqual({
        status: "available",
        executablePath: managedPath,
        source: "managed",
        version: CLOUDFLARED_VERSION,
      });
      expect(new TextDecoder().decode(yield* fileSystem.readFile(managedPath))).toBe(
        "test-cloudflared-binary",
      );
      expect(progress).toEqual([
        "checking",
        "waiting_for_lock",
        "downloading",
        "verifying",
        "installing",
        "validating",
        "activating",
      ]);
      expect(yield* manager.resolve).toEqual(installed);
    }).pipe(
      Effect.scoped,
      Effect.provide(
        Layer.mergeAll(
          NodeServices.layer,
          makeHttpClientLayer(new TextEncoder().encode("test-cloudflared-binary")),
          makeSpawnerLayer([]),
          hostRuntimeLayer(),
        ),
      ),
    ),
  );

  it.effect("rejects downloads whose checksum does not match the pinned manifest", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-cloudflared-test-",
      });
      const manager = yield* makeCloudflaredRelayClient({
        baseDir,
        releaseAsset: {
          url: "https://example.test/cloudflared",
          sha256: Encoding.encodeHex(sha256(new TextEncoder().encode("expected"))),
          archive: "binary",
        },
      });

      const error = yield* manager.install.pipe(Effect.flip);
      expect(error).toBeInstanceOf(RelayClientInstallError);
      expect(error.reason).toBe("invalid_checksum");
    }).pipe(
      Effect.scoped,
      Effect.provide(
        Layer.mergeAll(
          NodeServices.layer,
          makeHttpClientLayer(new TextEncoder().encode("tampered")),
          makeSpawnerLayer([]),
          hostRuntimeLayer(),
        ),
      ),
    ),
  );

  it.effect("serializes concurrent installs within one runtime", () => {
    const commands: Array<string> = [];
    const bytes = new TextEncoder().encode("test-cloudflared-binary");
    return Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-cloudflared-test-",
      });
      const manager = yield* makeCloudflaredRelayClient({
        baseDir,
        releaseAsset: {
          url: "https://example.test/cloudflared",
          sha256: Encoding.encodeHex(sha256(bytes)),
          archive: "binary",
        },
      });

      const [first, second] = yield* Effect.all([manager.install, manager.install], {
        concurrency: "unbounded",
      });
      expect(second).toEqual(first);
      expect(commands).toHaveLength(1);
    }).pipe(
      Effect.scoped,
      Effect.provide(
        Layer.mergeAll(
          NodeServices.layer,
          makeHttpClientLayer(bytes),
          makeSpawnerLayer(commands),
          hostRuntimeLayer(),
        ),
      ),
    );
  });

  it.effect("observes PATH changes after the manager has been constructed", () => {
    const env = { PATH: "" };
    return Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-cloudflared-test-",
      });
      const binDir = `${baseDir}/bin`;
      const executablePath = `${binDir}/cloudflared`;
      const manager = yield* makeCloudflaredRelayClient({
        baseDir,
      });

      expect(yield* manager.resolve).toEqual({
        status: "missing",
        version: CLOUDFLARED_VERSION,
      });

      yield* fileSystem.makeDirectory(binDir);
      yield* fileSystem.writeFileString(executablePath, "cloudflared");
      yield* fileSystem.chmod(executablePath, 0o755);
      env.PATH = binDir;

      expect(yield* manager.resolve).toEqual({
        status: "available",
        executablePath,
        source: "path",
        version: CLOUDFLARED_VERSION,
      });
    }).pipe(
      Effect.scoped,
      Effect.provide(
        Layer.mergeAll(
          NodeServices.layer,
          makeHttpClientLayer(new Uint8Array()),
          makeSpawnerLayer([]),
          hostRuntimeLayer(env),
        ),
      ),
    );
  });
});

describe("RelayClient G9 capture (W5c B3)", () => {
  it.effect("absent optional G9 capture leaves resolve/install unchanged", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-cloudflared-g9-absent-",
      });
      const manager = yield* makeCloudflaredRelayClient({ baseDir });
      expect(yield* manager.resolve).toEqual({
        status: "missing",
        version: CLOUDFLARED_VERSION,
      });
    }).pipe(
      Effect.scoped,
      Effect.provide(
        Layer.mergeAll(
          NodeServices.layer,
          makeHttpClientLayer(new Uint8Array()),
          makeSpawnerLayer([]),
          hostRuntimeLayer(),
        ),
      ),
    ),
  );

  it.effect("resolve captures FLAG-CLOUDFLARED configured|absent without path in A", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<
        Array<{
          readonly comm_id: string;
          readonly phase: string;
          readonly input: { readonly [key: string]: unknown };
        }>
      >([]);
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-cloudflared-g9-flag-",
      });
      const overridePath = `${baseDir}/override-cloudflared`;
      yield* fileSystem.writeFileString(overridePath, "override");
      yield* fileSystem.chmod(overridePath, 0o755);

      const captureLayer = Layer.succeed(RelayClientOptionalG9Capture, {
        captureOccurrence: (input) =>
          Ref.update(calls, (xs) => [...xs, input]).pipe(Effect.as(undefined)),
      });

      const manager = yield* makeCloudflaredRelayClient({ baseDir });

      yield* manager.resolve.pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { PATH: "" } }),
        ),
        Effect.provide(captureLayer),
      );
      yield* manager.resolve.pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({
            env: { PATH: "", T3CODE_CLOUDFLARED_PATH: overridePath },
          }),
        ),
        Effect.provide(captureLayer),
      );

      const seen = yield* Ref.get(calls);
      expect(seen).toEqual([
        {
          comm_id: "INV-T2-FLAG-CLOUDFLARED",
          phase: "flag-resolved",
          input: { member: CLOUDFLARED_PATH_ENV_NAME, state_label: "absent" },
        },
        {
          comm_id: "INV-T2-FLAG-CLOUDFLARED",
          phase: "flag-resolved",
          input: { member: CLOUDFLARED_PATH_ENV_NAME, state_label: "configured" },
        },
      ]);
      for (const call of seen) {
        expect(call.input).not.toHaveProperty("path");
        expect(call.input).not.toHaveProperty("executablePath");
      }
    }).pipe(
      Effect.scoped,
      Effect.provide(
        Layer.mergeAll(
          NodeServices.layer,
          makeHttpClientLayer(new Uint8Array()),
          makeSpawnerLayer([]),
          hostRuntimeLayer(),
        ),
      ),
    ),
  );

  it.effect("runCommand captures RELAY-CLIENT spawn then exit with site-only A", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<
        Array<{
          readonly comm_id: string;
          readonly phase: string;
          readonly input: { readonly [key: string]: unknown };
        }>
      >([]);
      const fileSystem = yield* FileSystem.FileSystem;
      const baseDir = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-cloudflared-g9-spawn-",
      });
      const bytes = new TextEncoder().encode("test-cloudflared-binary");
      const captureLayer = Layer.succeed(RelayClientOptionalG9Capture, {
        captureOccurrence: (input) =>
          Ref.update(calls, (xs) => [...xs, input]).pipe(Effect.as(undefined)),
      });

      const manager = yield* makeCloudflaredRelayClient({
        baseDir,
        releaseAsset: {
          url: "https://example.test/cloudflared",
          sha256: Encoding.encodeHex(sha256(bytes)),
          archive: "binary",
        },
      }).pipe(Effect.provide(captureLayer));

      yield* manager.install.pipe(Effect.provide(captureLayer));

      const seen = yield* Ref.get(calls);
      const relayPhases = seen.filter((c) => c.comm_id === "INV-T2-RELAY-CLIENT");
      expect(relayPhases.length).toBeGreaterThanOrEqual(2);
      expect(relayPhases[0]).toEqual({
        comm_id: "INV-T2-RELAY-CLIENT",
        phase: "cloudflared-spawn-succeeded",
        input: { site: "spawned" },
      });
      expect(relayPhases[1]).toEqual({
        comm_id: "INV-T2-RELAY-CLIENT",
        phase: "cloudflared-exit-succeeded",
        input: { site: "exited" },
      });
      for (const call of relayPhases) {
        expect(call.input).not.toHaveProperty("command");
        expect(call.input).not.toHaveProperty("args");
        expect(call.input).not.toHaveProperty("exitCode");
      }
    }).pipe(
      Effect.scoped,
      Effect.provide(
        Layer.mergeAll(
          NodeServices.layer,
          makeHttpClientLayer(new TextEncoder().encode("test-cloudflared-binary")),
          makeSpawnerLayer([]),
          hostRuntimeLayer(),
        ),
      ),
    ),
  );
});
