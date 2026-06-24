import {
  requestPasswordResetBodySchema,
  requestPasswordResetResponseSchema,
  resetPasswordBodySchema,
  resetPasswordCallbackParamsSchema,
  resetPasswordCallbackQuerySchema,
  resetPasswordCallbackResponseSchema,
  resetPasswordResponseSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { handleAuthRequest } from "../auth/routes";
import { jsonRequestBody, jsonResponse, parameter } from "./docs";
export const passwordRouter = new Elysia()
  .post(
    "/request-password-reset",
    ({ request }) => handleAuthRequest(request),
    {
      detail: {
        summary: "Request password reset",
        description: "Send a password reset email if the account exists.",
        tags: ["Authentication"],
        requestBody: jsonRequestBody(requestPasswordResetBodySchema),
        responses: {
          200: jsonResponse(
            "Password reset request accepted.",
            requestPasswordResetResponseSchema,
          ),
        },
      },
    },
  )
  .get("/reset-password/:token", ({ request }) => handleAuthRequest(request), {
    detail: {
      summary: "Password reset callback",
      description:
        "Validate a password reset token and redirect back to the supplied callback URL.",
      tags: ["Authentication"],
      parameters: [
        parameter({
          name: "token",
          in: "path",
          required: true,
          schema: resetPasswordCallbackParamsSchema.properties.token,
        }),
        parameter({
          name: "callbackURL",
          in: "query",
          required: true,
          schema: resetPasswordCallbackQuerySchema.properties.callbackURL,
        }),
      ],
      responses: {
        200: jsonResponse(
          "Password reset callback payload.",
          resetPasswordCallbackResponseSchema,
        ),
      },
    },
  })
  .post("/reset-password", ({ request }) => handleAuthRequest(request), {
    detail: {
      summary: "Reset password",
      description: "Reset a user password with a valid reset token.",
      tags: ["Authentication"],
      requestBody: jsonRequestBody(resetPasswordBodySchema),
      responses: {
        200: jsonResponse(
          "Password reset successful.",
          resetPasswordResponseSchema,
        ),
      },
    },
  });
