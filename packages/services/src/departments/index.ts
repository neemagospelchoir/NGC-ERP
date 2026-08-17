export { listDepartments, getDepartment } from "./list";
export type { ListDepartmentsOptions } from "./list";

export { createDepartment } from "./create";

export { updateDepartment, deactivateDepartment, reactivateDepartment } from "./update";

export type { Department, CreateDepartmentInput, UpdateDepartmentInput } from "./types";

export { ServiceError } from "../shared/errors";
