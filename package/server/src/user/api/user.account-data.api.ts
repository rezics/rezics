import {
  type DeleteAccountResult,
  deleteAccountBodySchema,
  deleteAccountResultSchema,
  type UserDataExport,
  userDataExportSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import {
  DeletionNotConfirmedError,
  deleteAccount,
  exportUserData,
} from "../service/account-data.service";

export const accountDataRoute = new Elysia()
  .use(authMacro)
  .post(
    "/me/export",
    async ({ identity }): Promise<UserDataExport> => {
      return exportUserData(identity.userId);
    },
    {
      requireLogin: true,
      response: userDataExportSchema,
      detail: {
        summary: "Export my data",
        description:
          "Assembles and returns the caller's profile, settings, authored content, and social graph as a single JSON payload.",
        tags: ["Users"],
      },
    },
  )
  .post(
    "/me/delete-account",
    async ({ identity, body, status }): Promise<DeleteAccountResult> => {
      try {
        await deleteAccount(identity.userId, body.confirmation);
      } catch (error) {
        if (error instanceof DeletionNotConfirmedError) {
          return status(400, { deleted: false }) as never;
        }
        throw error;
      }
      return { deleted: true };
    },
    {
      requireLogin: true,
      body: deleteAccountBodySchema,
      response: {
        200: deleteAccountResultSchema,
        400: deleteAccountResultSchema,
      },
      detail: {
        summary: "Delete my account",
        description:
          "Anonymizes the caller's account (scrubs PII, hides profile, removes blocks and follow edges) while retaining authored content and moderation/audit records. Requires `confirmation` to equal the account handle.",
        tags: ["Users"],
      },
    },
  );
