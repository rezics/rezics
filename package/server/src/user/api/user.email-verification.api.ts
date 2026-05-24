import {
  type UserEmailVerificationResponse,
  type UserEmailVerificationState,
  userEmailVerificationConfirmBodySchema,
  userEmailVerificationRequestBodySchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import {
  getUserEmailVerificationState,
  requestUserEmailVerification,
  verifyUserEmailContract,
} from "@/email-verification/user-email-verification.service";
import { authMacro } from "@/middleware";

export const userEmailVerificationApi = new Elysia()
  .use(authMacro)
  .get(
    "/me/email-verification",
    async ({ identity }): Promise<UserEmailVerificationState> => {
      return getUserEmailVerificationState(identity.userId);
    },
    {
      requireLogin: true,
      detail: {
        summary: "Get Rezics email verification state",
        description:
          "Returns main-owned user.email verification contract state.",
        tags: ["Users"],
      },
    },
  )
  .post(
    "/me/email-verification",
    async ({ identity, body }): Promise<UserEmailVerificationResponse> => {
      return requestUserEmailVerification(identity.userId, body.email);
    },
    {
      requireLogin: true,
      body: userEmailVerificationRequestBodySchema,
      detail: {
        summary: "Request Rezics email verification",
        description:
          "Creates or resends a main-owned user.email verification contract.",
        tags: ["Users"],
      },
    },
  )
  .post(
    "/me/email-verification/verify",
    async ({ identity, body }): Promise<UserEmailVerificationResponse> => {
      return verifyUserEmailContract({
        userId: identity.userId,
        email: body.email,
        code: body.code,
      });
    },
    {
      requireLogin: true,
      body: userEmailVerificationConfirmBodySchema,
      detail: {
        summary: "Verify Rezics email",
        description:
          "Verifies a main-owned user.email contract and writes User.email.",
        tags: ["Users"],
      },
    },
  );
