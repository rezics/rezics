import {Elysia} from 'elysia';
import {
  createOrgBodySchema,
  organizationDetailResponseSchema,
  inviteMemberBodySchema,
  acceptInvitationBodySchema,
  removeMemberBodySchema,
  updateMemberRoleBodySchema,
  listMembersResponseSchema,
} from '@package/contract';
import {handleAuthRequest} from '../auth/routes';

export const organizationRouter = new Elysia()
  .post('/organization/create', ({request}) => handleAuthRequest(request), {
    body: createOrgBodySchema,
    detail: {
      summary: 'Create organization',
      description: 'Create a new organization.',
      tags: ['Organization'],
    },
  })
  .get('/organization/get-full-organization', ({request}) => handleAuthRequest(request), {
    response: organizationDetailResponseSchema,
    detail: {
      summary: 'Get full organization',
      description: 'Get organization details including members.',
      tags: ['Organization'],
    },
  })
  .post('/organization/invite-member', ({request}) => handleAuthRequest(request), {
    body: inviteMemberBodySchema,
    detail: {
      summary: 'Invite member',
      description: 'Invite a user to join the organization by email.',
      tags: ['Organization'],
    },
  })
  .post('/organization/accept-invitation', ({request}) => handleAuthRequest(request), {
    body: acceptInvitationBodySchema,
    detail: {
      summary: 'Accept invitation',
      description: 'Accept an organization membership invitation.',
      tags: ['Organization'],
    },
  })
  .post('/organization/remove-member', ({request}) => handleAuthRequest(request), {
    body: removeMemberBodySchema,
    detail: {
      summary: 'Remove member',
      description: 'Remove a member from the organization.',
      tags: ['Organization'],
    },
  })
  .post('/organization/update-member-role', ({request}) => handleAuthRequest(request), {
    body: updateMemberRoleBodySchema,
    detail: {
      summary: 'Update member role',
      description: 'Update the role of an organization member.',
      tags: ['Organization'],
    },
  })
  .get('/organization/list-members', ({request}) => handleAuthRequest(request), {
    response: listMembersResponseSchema,
    detail: {
      summary: 'List members',
      description: 'List all members of an organization.',
      tags: ['Organization'],
    },
  });
