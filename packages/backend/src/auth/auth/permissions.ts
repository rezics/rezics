import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
  user: [
    "list",
    "get",
    "create",
    "update",
    "delete",
    "ban",
    "set-role",
    "impersonate",
    "impersonate-admins",
    "set-password",
  ],
  session: ["list", "revoke", "delete"],
  "jwt-service": ["list", "get", "create", "update", "activate", "deactivate"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  user: statement.user,
  session: statement.session,
  "jwt-service": statement["jwt-service"],
});

export const admin = ac.newRole({
  user: [
    "list",
    "get",
    "create",
    "update",
    "delete",
    "ban",
    "set-role",
    "impersonate",
    "set-password",
  ],
  session: statement.session,
});

export const user = ac.newRole({
  user: [],
  session: [],
  "jwt-service": [],
});

export const authRoles = {
  owner,
  admin,
  user,
} as const;
