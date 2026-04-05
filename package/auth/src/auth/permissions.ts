import {createAccessControl} from 'better-auth/plugins/access';

export const statement = {
  user: [
    'list',
    'get',
    'create',
    'update',
    'delete',
    'ban',
    'set-role',
    'impersonate',
    'impersonate-admins',
    'set-password',
  ],
  session: ['list', 'revoke', 'delete'],
  organization: ['create', 'update', 'delete'],
  member: ['create', 'update', 'delete', 'invite', 'remove', 'update-role'],
  invitation: ['create', 'cancel'],
  'jwt-service': ['list', 'get', 'create', 'update', 'activate', 'deactivate'],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  user: statement.user,
  session: statement.session,
  organization: statement.organization,
  member: statement.member,
  invitation: statement.invitation,
  'jwt-service': statement['jwt-service'],
});

export const admin = ac.newRole({
  user: [
    'list',
    'get',
    'create',
    'update',
    'delete',
    'ban',
    'set-role',
    'impersonate',
    'set-password',
  ],
  session: statement.session,
  organization: statement.organization,
  member: statement.member,
  invitation: statement.invitation,
});

export const user = ac.newRole({
  organization: ['create'],
});

export const member = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
});

export const authRoles = {
  owner,
  admin,
  user,
} as const;

export const organizationRoles = {
  owner: ac.newRole({
    organization: ['create', 'update', 'delete'],
    member: ['create', 'update', 'delete', 'invite', 'remove', 'update-role'],
    invitation: ['create', 'cancel'],
  }),
  admin: ac.newRole({
    organization: ['update'],
    member: ['create', 'update', 'delete', 'invite', 'remove', 'update-role'],
    invitation: ['create', 'cancel'],
  }),
  member,
} as const;
