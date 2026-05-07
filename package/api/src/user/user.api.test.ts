import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://api.example",
});

describe("userApi email verification", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("calls main-owned Rezics email verification endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            email: "reader@example.com",
            verified: true,
            contractStatus: "VERIFIED",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            state: {
              email: "reader@example.com",
              pendingEmail: "new@example.com",
              verified: false,
              contractStatus: "PENDING",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            state: {
              email: "new@example.com",
              verified: true,
              contractStatus: "VERIFIED",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const { userApi } = await import("./user.api");

    await userApi.getEmailVerificationState();
    await userApi.requestEmailVerification({ email: "new@example.com" });
    await userApi.verifyEmailContract({
      email: "new@example.com",
      code: "123456",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/user/me/email-verification",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://api.example/user/me/email-verification",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ email: "new@example.com" }),
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "http://api.example/user/me/email-verification/verify",
    );
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ email: "new@example.com", code: "123456" }),
    });
  });
});
