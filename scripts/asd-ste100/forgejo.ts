export interface ReviewerEntry {
  userId: number;
  principal: string;
  kind: "human" | "agent";
  ci: boolean;
}

export interface ReviewerRoster {
  reviewers: Array<ReviewerEntry>;
  identities?: Array<ReviewerEntry>;
  selfSignAllowed?: boolean;
}

export interface ForgejoCommit {
  sha: string;
  authorId: number | null;
  message: string;
}

export interface ForgejoPull {
  id: number;
  number: number;
  repositoryId: number;
  authorId: number;
  headSha: string;
  title: string;
  body: string;
  commits: Array<ForgejoCommit>;
}

export interface ForgejoReview {
  id: number;
  userId: number;
  state: "APPROVED" | "COMMENTED" | "DISMISSED" | "REQUEST_CHANGES";
  commitId: string;
  body: string;
}

export interface PullProseRecord {
  path: string;
  line: number;
  column: number;
  text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Forgejo payload field ${field} must be an integer`);
  }
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Forgejo payload field ${field} must be a string`);
  }
  return value;
}

export function parseForgejoPull(payload: unknown): ForgejoPull {
  if (!isRecord(payload)) {
    throw new Error("Forgejo pull payload must be an object");
  }
  const user = payload.user;
  const repository = payload.repository;
  const head = payload.head;
  if (!isRecord(user) || !isRecord(head)) {
    throw new Error("Forgejo pull payload is missing user or head");
  }
  const repositoryId = isRecord(repository)
    ? requiredNumber(repository.id, "repository.id")
    : requiredNumber(payload.repositoryId, "repositoryId");
  const commitsRaw = Array.isArray(payload.commits) ? payload.commits : [];
  return {
    id: requiredNumber(payload.id, "id"),
    number: requiredNumber(payload.number, "number"),
    repositoryId,
    authorId: requiredNumber(user.id, "user.id"),
    headSha: requiredString(head.sha, "head.sha"),
    title: requiredString(payload.title, "title"),
    body: typeof payload.body === "string" ? payload.body : "",
    commits: commitsRaw.map((commit, index) => {
      if (!isRecord(commit)) {
        throw new Error(`Forgejo commit ${index} must be an object`);
      }
      const authorId = commit.authorId;
      return {
        sha: requiredString(commit.sha, `commits[${index}].sha`),
        authorId:
          authorId === null || authorId === undefined
            ? null
            : requiredNumber(authorId, `commits[${index}].authorId`),
        message: requiredString(commit.message, `commits[${index}].message`),
      };
    }),
  };
}

export function parseForgejoReview(payload: unknown): ForgejoReview {
  if (!isRecord(payload)) {
    throw new Error("Forgejo review payload must be an object");
  }
  const user = payload.user;
  if (!isRecord(user)) {
    throw new Error("Forgejo review payload is missing user");
  }
  const state = requiredString(payload.state, "state");
  if (
    state !== "APPROVED" &&
    state !== "COMMENTED" &&
    state !== "DISMISSED" &&
    state !== "REQUEST_CHANGES"
  ) {
    throw new Error("Forgejo review state is not recognized");
  }
  return {
    id: requiredNumber(payload.id, "id"),
    userId: requiredNumber(user.id, "user.id"),
    state,
    commitId: requiredString(payload.commit_id ?? payload.commitId, "commit_id"),
    body: typeof payload.body === "string" ? payload.body : "",
  };
}

export function extractPullProse(pull: ForgejoPull): Array<PullProseRecord> {
  const records: Array<PullProseRecord> = [];
  if (pull.title.trim() !== "") {
    records.push({
      path: `pull/${pull.number}/title`,
      line: 1,
      column: 1,
      text: pull.title.trim(),
    });
  }
  if (pull.body.trim() !== "") {
    records.push({ path: `pull/${pull.number}/body`, line: 1, column: 1, text: pull.body.trim() });
  }
  return records;
}

export function findReviewer(roster: ReviewerRoster, userId: number): ReviewerEntry | undefined {
  return roster.reviewers.find((entry) => entry.userId === userId);
}

export function findIdentity(roster: ReviewerRoster, userId: number): ReviewerEntry | undefined {
  const identities = roster.identities ?? [];
  return identities.find((entry) => entry.userId === userId) ?? findReviewer(roster, userId);
}
