import {Elysia} from 'elysia';
import {
  createOrgBodySchema,
  organizationDetailResponseSchema,
  inviteMemberBodySchema,
  acceptInvitationBodySchema,
  removeMemberBodySchema,
  updateMemberRoleBodySchema,
  listMembersResponseSchema,
} from '@rezics/contract';
import {handleAuthRequest} from '../auth/routes';
import {jsonRequestBody, jsonResponse} from './docs';
import {authCorsPolicy} from '../cors';

export const organizationRouter = new Elysia().use(authCorsPolicy('credentialed'))
  .post('/organization/create', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Create organization',
      description: 'Create a new organization.',
      tags: ['Organization'],
      requestBody: jsonRequestBody(createOrgBodySchema),
    },
  })
  .get('/organization/get-full-organization', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Get full organization',
      description: 'Get organization details including members.',
      tags: ['Organization'],
      responses: {
        200: jsonResponse(
          'Organization detail with members.',
          organizationDetailResponseSchema,
        ),
      },
    },
  })
  .post('/organization/invite-member', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Invite member',
      description: 'Invite a user to join the organization by email.',
      tags: ['Organization'],
      requestBody: jsonRequestBody(inviteMemberBodySchema),
    },
  })
  .post('/organization/accept-invitation', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Accept invitation',
      description: 'Accept an organization membership invitation.',
      tags: ['Organization'],
      requestBody: jsonRequestBody(acceptInvitationBodySchema),
    },
  })
  .post('/organization/remove-member', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Remove member',
      description: 'Remove a member from the organization.',
      tags: ['Organization'],
      requestBody: jsonRequestBody(removeMemberBodySchema),
    },
  })
  .post('/organization/update-member-role', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Update member role',
      description: 'Update the role of an organization member.',
      tags: ['Organization'],
      requestBody: jsonRequestBody(updateMemberRoleBodySchema),
    },
  })
  .get('/organization/list-members', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'List members',
      description: 'List all members of an organization.',
      tags: ['Organization'],
      responses: {
        200: jsonResponse('Organization members.', listMembersResponseSchema),
      },
    },
  });
