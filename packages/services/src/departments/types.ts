export interface Department {
  id: string;
  name: string;
  description: string | null;
  leaderUserId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentInput {
  name: string;
  description?: string | null;
  leaderUserId?: string | null;
}

export interface UpdateDepartmentInput {
  name?: string;
  description?: string | null;
  leaderUserId?: string | null;
}
