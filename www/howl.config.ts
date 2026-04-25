import { defineConfig } from "@hushkey/howl/api";

type User = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
};

export interface UserContext {
  impersonatedUser?: User;
  user?: User;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface State {
  userContext?: UserContext;
  text: string;
}

export const roles = [
  "USER",
] as const;
export type Role = typeof roles[number];

export const { defineApi, config: apiConfig } = defineConfig<State, Role>({
  roles,
});
