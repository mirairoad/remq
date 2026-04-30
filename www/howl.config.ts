import { defineConfig, memoryCache } from "@hushkey/howl/api";

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
  client: {
    title: string;
    version: string;
  };
}

export const roles = [
  "USER",
] as const;
export type Role = typeof roles[number];

export const { defineApi, config: apiConfig } = defineConfig<State, Role>({
  roles,
  cache: memoryCache({ maxSize: 1000 }),
});
