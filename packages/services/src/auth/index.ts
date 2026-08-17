export { signInWithPassword } from "./sign-in";
export type { SignInInput, SignInResult } from "./sign-in";

export { signUpWithPassword } from "./sign-up";
export type { SignUpInput, SignUpResult } from "./sign-up";

export { resolveLoginIdentifier } from "./resolve-identifier";

export { signOut } from "./sign-out";

export { requestPasswordReset, updatePassword } from "./password-reset";

export { getSession } from "./session";

export { getCurrentUserWithRoles } from "./roles";
export type { AuthenticatedUser, AssignedRole, MemberSummary } from "./roles";

export { authorize } from "./authorize";

export { assignRole } from "./assign-role";
export type { AssignRoleInput } from "./assign-role";

export { AuthServiceError, mapSupabaseAuthError } from "./errors";
