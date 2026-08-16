export interface WorkRegistryTerm {
  term: string;
  kind: "noun" | "verb";
}

/** Canonical product name. STE prose still uses the work-registry noun. */
export const PRODUCT_NAME = "T2_Squared-Work-Registry";

/** T2 work-registry glossary. These are not Issue 9 dictionary rows. */
export const REQUIRED_WORK_REGISTRY_TERMS: ReadonlyArray<WorkRegistryTerm> = [
  { term: "work-registry", kind: "noun" },
  { term: "campaign", kind: "noun" },
  { term: "proposal", kind: "noun" },
  { term: "manifest", kind: "noun" },
  { term: "schema", kind: "noun" },
  { term: "drift", kind: "noun" },
  { term: "compile", kind: "verb" },
  { term: "approve", kind: "verb" },
  { term: "register", kind: "verb" },
  { term: "genesis", kind: "noun" },
  { term: "progeny", kind: "noun" },
  { term: "epoch", kind: "noun" },
  { term: "Forgejo-review", kind: "noun" },
];
