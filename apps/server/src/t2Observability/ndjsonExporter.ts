import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

export class T2NdjsonSpanExporter implements SpanExporter {
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  export(
    spans: Array<ReadableSpan>,
    resultCallback: (result: { readonly code: number; readonly error?: Error }) => void,
  ): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      const payload = `${spans.map((span) => JSON.stringify(toRecord(span))).join("\n")}\n`;
      appendFileSync(this.filePath, payload);
      resultCallback({ code: 0 });
    } catch (error) {
      resultCallback({
        code: 1,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

const toRecord = (span: ReadableSpan): Record<string, unknown> => {
  const context = span.spanContext();
  return {
    name: span.name,
    traceId: context.traceId,
    spanId: context.spanId,
    parentSpanId: span.parentSpanContext?.spanId,
    links: span.links.map((link) => ({
      traceId: link.context.traceId,
      spanId: link.context.spanId,
    })),
    attributes: span.attributes,
    resource: span.resource.attributes,
  };
};
