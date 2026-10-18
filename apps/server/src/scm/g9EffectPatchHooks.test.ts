/**
 * G9 WP6 Effect patch seam smoke tests (W6-PATCH).
 *
 * Intended: prove `patches/effect@4.0.0-beta.103.patch` applied the optional
 * RpcServer / MCP DELETE / OTLP ExportHooks Context.Service tags into the
 * installed `effect@4.0.0-beta.103` tree, with no collision against RpcClient hooks.
 * Observed: key + callback shape checks below; no capture / consumer wiring.
 *
 * Does not authorize G10. Does not land g9FamilyTypedHooks or ws/MCP/OTLP consumers.
 */
import { assert, describe, it } from "@effect/vitest";
import type * as Context from "effect/Context";
import { Effect } from "effect";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as OtlpExporter from "effect/unstable/observability/OtlpExporter";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

describe("G9 Effect patch typed-hook seams", () => {
  it("exposes RpcServerRequestHooks distinct from RpcClient.RequestHooks", () => {
    assert.equal(RpcServer.RpcServerRequestHooks.key, "effect/rpc/RpcServer/RequestHooks");
    assert.equal(RpcClient.RequestHooks.key, "effect/rpc/RpcClient/RequestHooks");
    assert.notEqual(RpcServer.RpcServerRequestHooks.key, RpcClient.RequestHooks.key);

    const shape: Context.Service.Shape<typeof RpcServer.RpcServerRequestHooks> = {
      onRequestAdmitted: ({ tag, stream }) => {
        assert.equal(typeof tag, "string");
        assert.equal(typeof stream, "boolean");
        return Effect.void;
      },
      onUnarySucceeded: ({ tag }) => {
        assert.equal(typeof tag, "string");
        return Effect.void;
      },
      onStreamElement: ({ tag }) => {
        assert.equal(typeof tag, "string");
        return Effect.void;
      },
    };
    assert.ok(shape.onRequestAdmitted);
    assert.ok(shape.onUnarySucceeded);
    assert.ok(shape.onStreamElement);
  });

  it("exposes McpServer.HttpSessionHooks for existing-session DELETE 204", () => {
    assert.equal(McpServer.HttpSessionHooks.key, "effect/ai/McpServer/HttpSessionHooks");
    const shape: Context.Service.Shape<typeof McpServer.HttpSessionHooks> = {
      onExistingSessionDeleted: ({ site }) => {
        assert.equal(site, "mcp-http-session-deleted");
        return Effect.void;
      },
    };
    assert.ok(shape.onExistingSessionDeleted);
  });

  it("exposes OtlpExporter.ExportHooks for post-success nonempty batches", () => {
    assert.equal(OtlpExporter.ExportHooks.key, "effect/observability/OtlpExporter/ExportHooks");
    const shape: Context.Service.Shape<typeof OtlpExporter.ExportHooks> = {
      onExportSucceeded: ({ label, batchSize }) => {
        assert.equal(typeof label, "string");
        assert.equal(typeof batchSize, "number");
        return Effect.void;
      },
    };
    assert.ok(shape.onExportSucceeded);
  });
});
