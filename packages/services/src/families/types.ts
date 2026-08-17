export interface Family {
  id: string;
  name: string;
  description: string | null;
  leaderUserId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFamilyInput {
  name: string;
  description?: string | null;
  leaderUserId?: string | null;
}

export interface UpdateFamilyInput {
  name?: string;
  description?: string | null;
  leaderUserId?: string | null;
}
