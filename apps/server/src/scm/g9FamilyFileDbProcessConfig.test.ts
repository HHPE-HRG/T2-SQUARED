/**
 * G9 WP5 B2 family helper tests (W5a).
 *
 * Intended: prove 18-row catalog, PROJECT-SQL 41-phase map, builders emit ledger
 * input shapes without SQL/file bytes, capture wrappers call captureOccurrence
 * once, declaration-absence refuses live capture.
 * Observed: assertions below against exported helpers only (no live-file edits).
 *
 * Does not flip g9toG10Authorized. Does not authorize G10.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

import {
  G9_B2_COMM_IDS,
  G9_FILE_LOGS_DECLARATION_ABSENCE_PHASE,
  G9_PROJECT_SQL_PHASE_INPUTS,
  buildAttachmentWriteCaptureInput,
  buildCheckpointCaptureInput,
  buildFileLogsDeclarationAbsenceInput,
  buildFileLogsDirCreateCaptureInput,
  buildFlagCloudflaredResolvedCaptureInput,
  buildFlagCodexLaunchResolvedCaptureInput,
  buildFlagServerConfigResolvedCaptureInput,
  buildFlagT2OtelResolvedCaptureInput,
  buildFlagT3OtelResolvedCaptureInput,
  buildFlagTermEnvFilteredCaptureInput,
  buildProjectReadCaptureInput,
  buildProjectSqlCaptureInput,
  buildProviderEventLogWriterCaptureInput,
  buildProviderSessionBindingCaptureInput,
  buildProviderStatusCacheReadCaptureInput,
  buildProviderStatusCacheWriteCaptureInput,
  buildRuntimeStateWriteCaptureInput,
  buildSecretStorePersistedCaptureInput,
  buildSettingsFileExistsCaptureInput,
  buildSettingsFileReadCaptureInput,
  buildSettingsFileWriteCaptureInput,
  buildSqliteExecuteCaptureInput,
  buildTerminalLogsWriterCaptureInput,
  buildUsageCachePersistedCaptureInput,
  buildWorktreeCreateCaptureInput,
  buildWorktreeRemoveCaptureInput,
  captureB2Occurrence,
  captureCheckpointSucceeded,
  captureFlagTermEnvFiltered,
  captureProjectSqlSucceeded,
  captureProviderEventLogWriterSucceeded,
  captureSettingsFileWriteSucceeded,
  captureTerminalLogsWriterSucceeded,
  isFileLogsDeclarationAbsencePhase,
  listProjectSqlPhaseIds,
  refuseFileLogsDeclarationAbsenceLiveCapture,
  type G9B2CaptureFn,
} from "./g9FamilyFileDbProcessConfig.ts";
import type { G9CaptureOccurrenceInput } from "./g9Occurrence.ts";

const PLAN_B2_COMM_IDS = [
  "INV-T2-FILE-ATTACHMENTS",
  "INV-T2-FILE-CHECKPOINTS",
  "INV-T2-FILE-LOGS",
  "INV-T2-FILE-PROVIDER-SESSION",
  "INV-T2-FILE-RUNTIME-STATE",
  "INV-T2-FILE-SECRETS",
  "INV-T2-FILE-SETTINGS",
  "INV-T2-FILE-USAGE-CACHE",
  "INV-T2-FILE-WORKTREES",
  "INV-T2-FLAG-CLOUDFLARED",
  "INV-T2-FLAG-CODEX-LAUNCH",
  "INV-T2-FLAG-SERVER-CONFIG",
  "INV-T2-FLAG-T2-OTEL",
  "INV-T2-FLAG-T3-OTEL",
  "INV-T2-FLAG-TERM-ENV",
  "INV-T2-PROJECT-READ",
  "INV-T2-PROJECT-SQL",
  "INV-T2-SQLITE",
] as const;

/** Assert input carries no SQL text / path / file-byte fields. */
const assertBoundedInputShape = (input: G9CaptureOccurrenceInput): void => {
  const serialized = JSON.stringify(input.input);
  assert.equal(/SELECT |INSERT |UPDATE |DELETE FROM/i.test(serialized), false);
  assert.equal(/\n/.test(serialized), false);
  for (const key of Object.keys(input.input as Record<string, unknown>)) {
    assert.equal(
      ["path", "sql", "bytes", "contents", "body", "raw"].includes(key),
      false,
      `forbidden retention key ${key}`,
    );
  }
};

describe("g9FamilyFileDbProcessConfig (B2 W5a)", () => {
  it("exports exactly the 18 plan B2 comm_ids", () => {
    assert.equal(G9_B2_COMM_IDS.length, 18);
    assert.deepEqual([...G9_B2_COMM_IDS].sort(), [...PLAN_B2_COMM_IDS].sort());
  });

  it("PROJECT-SQL map has 41 ledger phases with repository-only A", () => {
    const phases = listProjectSqlPhaseIds();
    assert.equal(phases.length, 41);
    assert.equal(Object.keys(G9_PROJECT_SQL_PHASE_INPUTS).length, 41);

    for (const phase of phases) {
      const built = buildProjectSqlCaptureInput(phase);
      assert.equal(built.comm_id, "INV-T2-PROJECT-SQL");
      assert.equal(built.phase, phase);
      assert.deepEqual(built.input, G9_PROJECT_SQL_PHASE_INPUTS[phase]);
      assertBoundedInputShape(built);
    }

    // Spot-check ledger quirks: upsert vs repository-name vs method name.
    assert.deepEqual(G9_PROJECT_SQL_PHASE_INPUTS["ProjectionCheckpoints-upsert-succeeded"], {
      repository: "upsert",
    });
    assert.deepEqual(
      G9_PROJECT_SQL_PHASE_INPUTS["ProjectionCheckpoints-listByThreadId-succeeded"],
      { repository: "ProjectionCheckpoints" },
    );
    assert.deepEqual(G9_PROJECT_SQL_PHASE_INPUTS["ProjectionTurns-upsertByTurnId-succeeded"], {
      repository: "upsertByTurnId",
    });
  });

  it("builders cover remaining B2 rows with ledger-bounded input", () => {
    const samples: G9CaptureOccurrenceInput[] = [
      buildProjectReadCaptureInput("getSnapshot"),
      buildSqliteExecuteCaptureInput("execute"),
      buildSettingsFileExistsCaptureInput(),
      buildSettingsFileReadCaptureInput(),
      buildSettingsFileWriteCaptureInput(),
      buildRuntimeStateWriteCaptureInput("serverRuntimeStatePath"),
      buildRuntimeStateWriteCaptureInput("environmentIdPath"),
      buildRuntimeStateWriteCaptureInput("anonymousIdPath"),
      buildRuntimeStateWriteCaptureInput("keybindingsConfigPath"),
      buildWorktreeCreateCaptureInput(),
      buildWorktreeRemoveCaptureInput(),
      buildAttachmentWriteCaptureInput(),
      buildUsageCachePersistedCaptureInput(),
      buildSecretStorePersistedCaptureInput(),
      buildCheckpointCaptureInput("captureCheckpoint"),
      buildCheckpointCaptureInput("restoreCheckpoint"),
      buildCheckpointCaptureInput("diffCheckpoints"),
      buildCheckpointCaptureInput("deleteCheckpointRefs"),
      buildCheckpointCaptureInput("hasCheckpointRef"),
      buildProviderStatusCacheReadCaptureInput(),
      buildProviderStatusCacheWriteCaptureInput(),
      buildProviderSessionBindingCaptureInput("upsert"),
      buildProviderSessionBindingCaptureInput("getByThreadId"),
      buildProviderSessionBindingCaptureInput("list"),
      buildProviderSessionBindingCaptureInput("deleteByThreadId"),
      buildFileLogsDirCreateCaptureInput("logsDir"),
      buildFileLogsDirCreateCaptureInput("providerLogsDir"),
      buildFileLogsDirCreateCaptureInput("terminalLogsDir"),
      buildProviderEventLogWriterCaptureInput(),
      buildTerminalLogsWriterCaptureInput(),
      buildFlagT2OtelResolvedCaptureInput("T2CODE_TRACE_FILE", "configured"),
      buildFlagT3OtelResolvedCaptureInput(),
      buildFlagServerConfigResolvedCaptureInput(),
      buildFlagCodexLaunchResolvedCaptureInput("absent"),
      buildFlagCloudflaredResolvedCaptureInput("configured"),
      buildFlagTermEnvFilteredCaptureInput(),
    ];

    for (const sample of samples) {
      assert.equal(
        G9_B2_COMM_IDS.includes(sample.comm_id as (typeof G9_B2_COMM_IDS)[number]),
        true,
      );
      assertBoundedInputShape(sample);
    }

    assert.deepEqual(buildCheckpointCaptureInput("hasCheckpointRef").input, {
      operation: "succeeded",
    });
    assert.deepEqual(buildSettingsFileWriteCaptureInput().input, { operation: "write" });
    assert.deepEqual(buildProviderStatusCacheWriteCaptureInput().input, {
      member_id: "write",
    });
  });

  it("declaration-absence phase is identified and refuses live capture", () => {
    assert.equal(isFileLogsDeclarationAbsencePhase(G9_FILE_LOGS_DECLARATION_ABSENCE_PHASE), true);
    const absence = buildFileLogsDeclarationAbsenceInput();
    assert.equal(absence.phase, "serverLogPath-declared-no-live-writer");
    assert.deepEqual(absence.input, { member_id: "serverLogPath" });

    let calls = 0;
    const capture: G9B2CaptureFn = () => {
      calls += 1;
      return Effect.succeed(undefined);
    };
    const refused = refuseFileLogsDeclarationAbsenceLiveCapture(capture);
    assert.equal(refused, undefined);
    assert.equal(calls, 0);
  });

  it.effect("capture wrappers invoke captureOccurrence once with builder input", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture: G9B2CaptureFn = (input) =>
        Ref.update(calls, (xs) => [...xs, input]).pipe(Effect.as(undefined));

      yield* captureProjectSqlSucceeded("ProjectionCheckpoints-upsert-succeeded", capture);
      yield* captureSettingsFileWriteSucceeded(capture);
      yield* captureTerminalLogsWriterSucceeded(capture);
      yield* captureProviderEventLogWriterSucceeded(capture);
      yield* captureFlagTermEnvFiltered(capture);
      yield* captureCheckpointSucceeded("captureCheckpoint", capture);
      yield* captureB2Occurrence(buildSqliteExecuteCaptureInput("executeRaw"), capture);

      const recorded = yield* Ref.get(calls);
      assert.equal(recorded.length, 7);
      assert.deepEqual(recorded[0], {
        comm_id: "INV-T2-PROJECT-SQL",
        phase: "ProjectionCheckpoints-upsert-succeeded",
        input: { repository: "upsert" },
      });
      assert.deepEqual(recorded[1], {
        comm_id: "INV-T2-FILE-SETTINGS",
        phase: "settings-file-write-succeeded",
        input: { operation: "write" },
      });
      assert.deepEqual(recorded[2], {
        comm_id: "INV-T2-FILE-LOGS",
        phase: "terminalLogs-writer-succeeded",
        input: { member_id: "terminalLogs" },
      });
      assert.deepEqual(recorded[3], {
        comm_id: "INV-T2-FILE-LOGS",
        phase: "providerEventLogPath-writer-succeeded",
        input: { member_id: "providerEventLogPath" },
      });
      assert.deepEqual(recorded[4], {
        comm_id: "INV-T2-FLAG-TERM-ENV",
        phase: "terminal-child-env-filtered",
        input: { kind: "terminal-child-env-filtered" },
      });
      assert.deepEqual(recorded[5], {
        comm_id: "INV-T2-FILE-CHECKPOINTS",
        phase: "checkpoint-captureCheckpoint-succeeded",
        input: { operation: "captureCheckpoint" },
      });
      assert.deepEqual(recorded[6], {
        comm_id: "INV-T2-SQLITE",
        phase: "sqlite-execute-succeeded",
        input: { operation: "executeRaw" },
      });
    }),
  );
});
