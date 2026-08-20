import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  parseForgejoPull,
  parseForgejoReview,
  type ForgejoPull,
  type ForgejoReview,
  type ReviewerRoster,
} from "./forgejo.ts";
import {
  loadMappingPrincipalsFile,
  selfSignAllowed,
  type MappingPrincipalsFile,
} from "./mapping/promote.ts";

export interface ConnectedReviewDeps {
  pull?: ForgejoPull;
  review?: ForgejoReview;
  roster?: ReviewerRoster;
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function loadReviewerFile(root: string): ReviewerRoster {
  const filePath = path.join(root, "t2.asd-ste100.reviewers.json");
  if (!existsSync(filePath)) {
    return { reviewers: [] };
  }
  const parsed = readJson(filePath);
  if (!isRecord(parsed) || !Array.isArray(parsed.reviewers)) {
    return { reviewers: [] };
  }
  return parsed as ReviewerRoster;
}

function operatorPrincipal(file: MappingPrincipalsFile): string {
  const profile = file.profiles?.find((entry) => entry.kind === "human");
  if (profile !== undefined) {
    return profile.principal;
  }
  const identity = file.identities.find((entry) => entry.kind === "human");
  return identity?.principal ?? `t2-single-operator`;
}

function parseEventPull(payload: unknown): ForgejoPull | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  const nested = payload.pull_request;
  const source = isRecord(nested) ? { ...nested } : payload;
  if (!isRecord(source)) {
    return undefined;
  }
  if (!isRecord(source.repository) && isRecord(payload.repository)) {
    source.repository = payload.repository;
  }
  try {
    return parseForgejoPull(source);
  } catch {
    return undefined;
  }
}

function parseReviewPayload(payload: unknown, headSha: string): ForgejoReview | undefined {
  const rows = Array.isArray(payload) ? payload : [payload];
  const parsed: Array<ForgejoReview> = [];
  for (const row of rows) {
    try {
      parsed.push(parseForgejoReview(row));
    } catch {
      continue;
    }
  }
  const approved = parsed.filter(
    (review) => review.state === "APPROVED" && review.commitId === headSha,
  );
  return approved.at(-1) ?? parsed.at(-1);
}

function fetchPullReviews(repository: string, number: number): unknown {
  const api = process.env.GITHUB_API_URL ?? process.env.GITEA_API_URL;
  const token = process.env.GITHUB_TOKEN ?? process.env.GITEA_TOKEN;
  if (api === undefined || api === "" || token === undefined || token === "") {
    return undefined;
  }
  const url = `${api.replace(/\/$/, "")}/repos/${repository}/pulls/${number}/reviews`;
  try {
    const body = execFileSync(
      "curl",
      ["-sS", "-H", `Authorization: token ${token}`, "-H", `Accept: application/json`, url],
      { encoding: "utf8", timeout: 15000, maxBuffer: 2_000_000 },
    );
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function withSelfSignRoster(
  roster: ReviewerRoster,
  pull: ForgejoPull | undefined,
  file: MappingPrincipalsFile,
): ReviewerRoster {
  const threshold =
    file.selfSignWhenHumanProfileCountBelow ?? file.selfSignWhenHumanCountBelow ?? 2;
  const allow = selfSignAllowed(file.identities, threshold, file.profiles);
  if (!allow || pull === undefined) {
    return { ...roster, selfSignAllowed: allow };
  }
  const principal = operatorPrincipal(file);
  const author = {
    userId: pull.authorId,
    principal,
    kind: "human" as const,
    ci: false,
  };
  const reviewers = roster.reviewers.some((entry) => entry.userId === author.userId)
    ? roster.reviewers
    : [...roster.reviewers, author];
  const identities = [...(roster.identities ?? [])];
  if (!identities.some((entry) => entry.userId === author.userId)) {
    identities.push(author);
  }
  return { reviewers, identities, selfSignAllowed: true };
}

export function loadConnectedReviewFromEnv(root: string): ConnectedReviewDeps {
  const file = loadMappingPrincipalsFile(root);
  const rosterFile = loadReviewerFile(root);
  const eventPath = process.env.GITHUB_EVENT_PATH;
  let pull: ForgejoPull | undefined;
  if (eventPath !== undefined && eventPath !== "" && existsSync(eventPath)) {
    pull = parseEventPull(readJson(eventPath));
  }
  let reviewPayload: unknown;
  const reviewPath = process.env.ASD_STE100_REVIEW_JSON;
  if (reviewPath !== undefined && reviewPath !== "" && existsSync(reviewPath)) {
    reviewPayload = readJson(reviewPath);
  } else if (pull !== undefined) {
    const repository = process.env.GITHUB_REPOSITORY;
    if (repository !== undefined && repository !== "") {
      reviewPayload = fetchPullReviews(repository, pull.number);
    }
  }
  const review =
    pull === undefined || reviewPayload === undefined
      ? undefined
      : parseReviewPayload(reviewPayload, pull.headSha);
  return {
    pull,
    review,
    roster: withSelfSignRoster(rosterFile, pull, file),
  };
}
