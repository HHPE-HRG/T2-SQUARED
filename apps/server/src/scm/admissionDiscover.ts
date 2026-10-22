/**
 * Read-only discovery collectors for admission reconcile.
 *
 * Intended: preview tool names, host MCP servers, skill instruction files,
 * bundled scripts, and provider-native tool names become proposed records.
 * A skill file does not admit the script it mentions. Provider-native names
 * are C9 or C12 at boundary B4 and stay outside granular guarantees.
 * Host MCP entries are discovered nodes, not grants.
 *
 * Observed: builds records from caller-supplied names and from the closed
 * preview operation map. Does not call tools/list, does not spawn a process,
 * and does not read provider adapters at runtime. The preview map is the
 * catalog the invoke path admits against. A toolkit name that is absent here
 * is a new proposed capability, which dispatch will deny until re-admit.
 */
import type { PreviewAutomationOperation } from "@t3tools/contracts";

import {
  createCapabilityRecord,
  digestCanonical,
  type CapabilityRecord,
  type ClassId,
  type EffectClass,
} from "./admissionCatalog.ts";

/** Preview MCP tool name to the automation operation the handler receives. */
export const previewCapabilityIdForOperation = (operation: PreviewAutomationOperation): string => {
  switch (operation) {
    case "status":
      return "preview_status";
    case "open":
      return "preview_open";
    case "navigate":
      return "preview_navigate";
    case "resize":
      return "preview_resize";
    case "setColorScheme":
      return "preview_set_appearance";
    case "snapshot":
      return "preview_snapshot";
    case "click":
      return "preview_click";
    case "type":
      return "preview_type";
    case "press":
      return "preview_press";
    case "scroll":
      return "preview_scroll";
    case "evaluate":
      return "preview_evaluate";
    case "waitFor":
      return "preview_wait_for";
    case "recordingStart":
      return "preview_recording_start";
    case "recordingStop":
      return "preview_recording_stop";
    default: {
      const _never: never = operation;
      return _never;
    }
  }
};

const PREVIEW_EFFECT: Record<string, readonly EffectClass[]> = {
  preview_status: ["E1"],
  preview_snapshot: ["E1"],
  preview_wait_for: ["E1"],
  preview_navigate: ["E2"],
  preview_evaluate: ["E6"],
};

/**
 * Proposed C4 records for preview tool names. Names outside the operation map
 * stay proposed with that raw name as the operation, so a catalog refresh
 * cannot inherit an existing grant.
 */
export const discoverPreviewTools = (toolNames: readonly string[]): readonly CapabilityRecord[] => {
  const known = new Map(
    [
      "preview_status",
      "preview_open",
      "preview_navigate",
      "preview_resize",
      "preview_set_appearance",
      "preview_snapshot",
      "preview_click",
      "preview_type",
      "preview_press",
      "preview_scroll",
      "preview_evaluate",
      "preview_wait_for",
      "preview_recording_start",
      "preview_recording_stop",
    ].map((name) => [name, true]),
  );
  return toolNames.map((name) => {
    const operation = known.has(name) ? operationForPreviewTool(name) : name;
    return createCapabilityRecord({
      capability_id: name,
      node_id: "mcp.preview",
      operation,
      class_id: "C4",
      effect_classes: PREVIEW_EFFECT[name] ?? ["E3"],
      boundary: "B0",
      adapter_type: "preview-mcp",
      implementation_digest: digestCanonical(`${name}\n${operation}`),
      input_schema: name,
      output_schema: "preview-automation",
      allowed_destinations: ["preview"],
      admission_state: "proposed",
    });
  });
};

const operationForPreviewTool = (name: string): string => {
  switch (name) {
    case "preview_status":
      return "status";
    case "preview_open":
      return "open";
    case "preview_navigate":
      return "navigate";
    case "preview_resize":
      return "resize";
    case "preview_set_appearance":
      return "setColorScheme";
    case "preview_snapshot":
      return "snapshot";
    case "preview_click":
      return "click";
    case "preview_type":
      return "type";
    case "preview_press":
      return "press";
    case "preview_scroll":
      return "scroll";
    case "preview_evaluate":
      return "evaluate";
    case "preview_wait_for":
      return "waitFor";
    case "preview_recording_start":
      return "recordingStart";
    case "preview_recording_stop":
      return "recordingStop";
    default:
      return name;
  }
};

export type HostMcpConfig = {
  readonly mcpServers?: Readonly<Record<string, { readonly command?: string }>>;
};

/**
 * Host MCP servers from `.mcp.json`-shaped config. Each server is one proposed
 * node. Listing the server does not admit its tools.
 */
export const discoverHostMcpServers = (config: HostMcpConfig): readonly CapabilityRecord[] =>
  Object.entries(config.mcpServers ?? {}).map(([name, server]) =>
    createCapabilityRecord({
      capability_id: `mcp-host:${name}`,
      node_id: name,
      operation: "tools/list",
      class_id: "C4",
      effect_classes: ["E6"],
      boundary: "B3",
      adapter_type: "mcp-host",
      implementation_digest: digestCanonical(`${name}\n${server.command ?? ""}`),
      input_schema: "mcp.tools/list",
      output_schema: "mcp.tools/call",
      allowed_destinations: [name],
      admission_state: "proposed",
    }),
  );

export type SkillEntry = {
  readonly path: string;
  readonly textDigest: string;
};

const scriptSuffix = /\.(py|sh|js|mjs|ts)$/;

/**
 * Skill instruction files are C1 resource reads. A bundled script is a separate
 * C3 candidate. Admitting the skill id does not admit the script id.
 */
export const discoverSkillEntries = (entries: readonly SkillEntry[]): readonly CapabilityRecord[] =>
  entries.map((entry) => {
    const base = entry.path.split("/").pop() ?? entry.path;
    const isScript = base !== "SKILL.md" && scriptSuffix.test(base);
    const classId: ClassId = isScript ? "C3" : "C1";
    return createCapabilityRecord({
      capability_id: isScript ? `script:${entry.path}` : `skill:${entry.path}`,
      node_id: entry.path,
      operation: isScript ? "execute" : "read",
      class_id: classId,
      effect_classes: isScript ? ["E4"] : ["E1"],
      boundary: isScript ? "B1" : "B0",
      adapter_type: isScript ? "skill-script" : "skill-instruction",
      implementation_digest: entry.textDigest,
      input_schema: isScript ? "argv" : "prose",
      output_schema: isScript ? "process-exit" : "instruction",
      allowed_destinations: [],
      admission_state: "proposed",
    });
  });

/**
 * Provider built-in names the adapters already classify (search, shell, file
 * change, MCP). Boundary B4. These records are discovered only.
 */
export const PROVIDER_NATIVE_TOOLS = [
  {
    capability_id: "provider.web_search",
    operation: "web_search",
    class_id: "C12",
    effect_classes: ["E2", "E6"],
  },
  {
    capability_id: "provider.command_execution",
    operation: "command_execution",
    class_id: "C9",
    effect_classes: ["E5", "E6"],
  },
  {
    capability_id: "provider.file_change",
    operation: "file_change",
    class_id: "C9",
    effect_classes: ["E3"],
  },
  {
    capability_id: "provider.mcp_tool_call",
    operation: "mcp_tool_call",
    class_id: "C9",
    effect_classes: ["E6"],
  },
] as const satisfies readonly {
  readonly capability_id: string;
  readonly operation: string;
  readonly class_id: ClassId;
  readonly effect_classes: readonly EffectClass[];
}[];

/** Proposed outside-guarantee records. `admitCapability` refuses every row. */
export const discoverProviderNative = (): readonly CapabilityRecord[] =>
  PROVIDER_NATIVE_TOOLS.map((tool) =>
    createCapabilityRecord({
      capability_id: tool.capability_id,
      node_id: "provider-native",
      operation: tool.operation,
      class_id: tool.class_id,
      effect_classes: tool.effect_classes,
      boundary: "B4",
      adapter_type: "provider-native",
      implementation_digest: digestCanonical(tool.capability_id),
      input_schema: tool.operation,
      output_schema: "provider-observed",
      allowed_destinations: [],
      admission_state: "proposed",
    }),
  );
