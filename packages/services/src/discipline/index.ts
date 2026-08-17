export { findMemberByNumber } from "./find-member";
export type { DisciplineMemberLookup } from "./find-member";

export { createCase } from "./create-case";
export { listCases, getCase, listActions } from "./list";
export { advanceCaseStatus } from "./case-status";
export { recordAction } from "./record-action";
export { restoreSuspension } from "./restore-suspension";
export { listDisciplineCategories } from "./categories";

export type {
  CaseStatus,
  ActionType,
  DisciplineCategoryOption,
  CaseSummary,
  CreateCaseInput,
  ListCasesOptions,
  ActionSummary,
  RecordActionInput,
  RestoreSuspensionInput,
} from "./types";
export { ACTION_TYPES } from "./types";

export { ServiceError } from "../shared/errors";
