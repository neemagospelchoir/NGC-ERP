export { listMembers, getMember, getMemberByQrToken } from "./list";

export { createMember } from "./create";

export { updateMemberContactInfo } from "./update-contact-info";

export { updateMemberRecord } from "./update-record";

export { assignDepartment, endDepartmentAssignment } from "./assign-department";
export type { AssignDepartmentInput } from "./assign-department";

export { assignFamily } from "./assign-family";
export type { AssignFamilyInput } from "./assign-family";

export type {
  MemberSummary,
  MemberDetail,
  ListMembersOptions,
  MemberContactInfoInput,
  MemberRecordInput,
  CreateMemberInput,
} from "./types";

export { ServiceError } from "../shared/errors";
