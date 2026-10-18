/**
 * WP5 B4 provider-protocol family tests (Mode B Wave W5a/W5c).
 *
 * Intended: helpers call captureOccurrence once with ledger-bounded input;
 * MCP non-hook handoff notes target WP6 McpHttpServer; session-deleted stays
 * out of the B4 callable union; RpcServer/OTLP are not authored here.
 * captureWhenG9Present proves optional G9CaptureService noninterference.
 *
 * Observed: assertions below against mocked capture Ref. Does not authorize G10.
 */
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { G9_LEDGER_PHASE_PAIRS } from "./g9CaptureInput.generated.ts";
import {
  B4_PROVIDER_PROTOCOL_COMM_IDS,
  G9_B4_MCP_HTTP_NON_HOOK_HANDOFF,
  buildHttpAuthCaptureInput,
  buildHttpStaticCaptureInput,
  buildProviderClaudeCaptureInput,
  buildProviderCodexCaptureInput,
  buildProviderEventsCaptureInput,
  buildProviderTurnCaptureInput,
  captureHttpAuthAdmitted,
  captureMcpHttpHandlerSucceeded,
  captureMcpHttpMessageAdmitted,
  captureProviderProtocolOccurrence,
  captureWhenG9Present,
  type G9B4AssertNoMcpSessionDeleted,
  type G9B4CaptureOccurrenceInput,
  type G9B4McpSessionDeletedExtract,
} from "./g9FamilyProviderProtocol.ts";
import { G9CaptureService } from "./g9OrchQueueCapture.ts";
import type { G9CaptureOccurrenceInput, G9CaptureResult, G9EqualityA } from "./g9Occurrence.ts";

/** Test stub: shape only; does not prove coordinator W1 projection. */
const stubEnqueued = (input: G9CaptureOccurrenceInput): G9CaptureResult => ({
  status: "enqueued",
  occurrence: {
    comm_id: input.comm_id,
    phase_id: input.phase,
    node_id: "node.test",
    origin_bus_id: "bus.test",
    attempt_sequence: 0,
    equality_A: input.input as G9EqualityA,
    semanticKind: "request",
    request_label: input.phase,
    state_label: "",
    retainCurrentAfterPublish: false,
  },
});
describe("g9FamilyProviderProtocol (WP5 B4)", () => {
  it("B4 comm_id set is sixteen ledger rows with forty-one phases", () => {
    assert.equal(B4_PROVIDER_PROTOCOL_COMM_IDS.length, 16);
    const b4Set = new Set<string>(B4_PROVIDER_PROTOCOL_COMM_IDS);
    const phases = G9_LEDGER_PHASE_PAIRS.filter((p) => b4Set.has(p.comm_id));
    assert.equal(phases.length, 41);
    const sessionDeleted = phases.filter((p) => p.phase_id === "mcp-http-session-deleted");
    assert.equal(sessionDeleted.length, 1);
  });

  it("MCP handoff notes name WP6 McpHttpServer and the two non-hook phases", () => {
    assert.equal(G9_B4_MCP_HTTP_NON_HOOK_HANDOFF.lander, "WP6-Consumer-Owner");
    assert.equal(G9_B4_MCP_HTTP_NON_HOOK_HANDOFF.live_file, "apps/server/src/mcp/McpHttpServer.ts");
    assert.equal(G9_B4_MCP_HTTP_NON_HOOK_HANDOFF.phases.length, 2);
    assert.equal(G9_B4_MCP_HTTP_NON_HOOK_HANDOFF.phases[0]?.phase, "mcp-http-message-admitted");
    assert.equal(G9_B4_MCP_HTTP_NON_HOOK_HANDOFF.phases[0]?.live_site, "authenticateRequest");
    assert.equal(G9_B4_MCP_HTTP_NON_HOOK_HANDOFF.phases[1]?.phase, "mcp-http-handler-succeeded");
    assert.equal(G9_B4_MCP_HTTP_NON_HOOK_HANDOFF.phases[1]?.live_site, "normalizeMcpHttpResponse");
    assert.equal(G9_B4_MCP_HTTP_NON_HOOK_HANDOFF.wp6_only_phase.phase, "mcp-http-session-deleted");
    assert.equal(
      G9_B4_MCP_HTTP_NON_HOOK_HANDOFF.forbidden_in_w5a.includes(
        "apps/server/src/mcp/McpHttpServer.ts commits",
      ),
      true,
    );
  });

  it("G9B4McpSessionDeletedExtract is never (session-deleted not callable in B4)", () => {
    // Agent: assignability to never proves Exclude worked after Task 14 widen.
    const extractProof: G9B4McpSessionDeletedExtract = undefined as never;
    const assertProof: G9B4AssertNoMcpSessionDeleted = extractProof;
    void assertProof;
    assert.equal(true, true);
  });

  it.effect("HTTP AUTH admit calls captureOccurrence once with endpoint-only A", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      yield* captureHttpAuthAdmitted(capture, "session");
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-HTTP-AUTH",
        phase: "http-request-admitted",
        input: { endpoint: "session" },
      });
    }),
  );

  it.effect("captureWhenG9Present is no-op when G9CaptureService absent", () =>
    Effect.gen(function* () {
      let ran = false;
      yield* captureWhenG9Present(() =>
        Effect.sync(() => {
          ran = true;
        }),
      );
      assert.equal(ran, false);
    }),
  );

  it.effect("captureWhenG9Present invokes run once when G9CaptureService present", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const layer = Layer.succeed(G9CaptureService, {
        captureOccurrence: (input) =>
          Effect.gen(function* () {
            yield* Ref.update(calls, (xs) => [...xs, input]);
            return stubEnqueued(input);
          }),
      });
      yield* captureWhenG9Present((capture) =>
        captureProviderProtocolOccurrence(
          capture,
          buildProviderTurnCaptureInput("send-turn-admitted"),
        ),
      ).pipe(Effect.provide(layer));
      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, 1);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-PROVIDER-TURN",
        phase: "send-turn-admitted",
        input: { comm_id: "send-turn-admitted" },
      });
    }),
  );

  it.effect("builders + captureProviderProtocolOccurrence cover HTTP/static/provider/MCP", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<G9CaptureOccurrenceInput[]>([]);
      const capture = (input: G9CaptureOccurrenceInput) =>
        Effect.gen(function* () {
          yield* Ref.update(calls, (xs) => [...xs, input]);
          return stubEnqueued(input);
        });

      const inputs: G9B4CaptureOccurrenceInput[] = [
        buildHttpAuthCaptureInput("http-handler-succeeded", "token"),
        buildHttpStaticCaptureInput("static-file-200-selected"),
        buildProviderTurnCaptureInput("send-turn-admitted"),
        buildProviderEventsCaptureInput("turn.started"),
        buildProviderCodexCaptureInput({
          phase: "protocol-request-succeeded",
          operation: "turn/start",
        }),
        buildProviderClaudeCaptureInput({ phase: "cli-version-probe-succeeded" }),
      ];

      for (const input of inputs) {
        yield* captureProviderProtocolOccurrence(capture, input);
      }
      yield* captureMcpHttpMessageAdmitted(capture);
      yield* captureMcpHttpHandlerSucceeded(capture);

      const seen = yield* Ref.get(calls);
      assert.equal(seen.length, inputs.length + 2);
      assert.deepEqual(seen[0], {
        comm_id: "INV-T2-HTTP-AUTH",
        phase: "http-handler-succeeded",
        input: { endpoint: "token" },
      });
      assert.deepEqual(seen[1], {
        comm_id: "INV-T2-HTTP-STATIC",
        phase: "static-file-200-selected",
        input: { comm_id: "static-file-200-selected" },
      });
      assert.deepEqual(seen[2], {
        comm_id: "INV-T2-PROVIDER-TURN",
        phase: "send-turn-admitted",
        input: { comm_id: "send-turn-admitted" },
      });
      assert.deepEqual(seen[3], {
        comm_id: "INV-T2-PROVIDER-EVENTS",
        phase: "pubsub-published",
        input: { member_id: "turn.started" },
      });
      assert.deepEqual(seen[4], {
        comm_id: "INV-T2-PROVIDER-CODEX",
        phase: "protocol-request-succeeded",
        input: { operation: "turn/start" },
      });
      assert.deepEqual(seen[5], {
        comm_id: "INV-T2-PROVIDER-CLAUDE",
        phase: "cli-version-probe-succeeded",
        input: { operation: "claude-cli-version" },
      });
      assert.deepEqual(seen[6], {
        comm_id: "INV-T2-MCP-HTTP",
        phase: "mcp-http-message-admitted",
        input: { site: "mcp-http-message-admitted" },
      });
      assert.deepEqual(seen[7], {
        comm_id: "INV-T2-MCP-HTTP",
        phase: "mcp-http-handler-succeeded",
        input: { site: "mcp-http-handler-succeeded" },
      });

      for (const call of seen) {
        assert.notEqual(call.phase, "mcp-http-session-deleted");
        assert.equal(call.comm_id.startsWith("INV-T2-RPC"), false);
        assert.equal(call.comm_id.includes("OTLP"), false);
      }
    }),
  );
});
