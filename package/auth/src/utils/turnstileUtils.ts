import { env } from "../env";

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export async function verifyTurnstileToken(
  token: string,
): Promise<TurnstileResponse> {
  if (!token) return { success: false };

  const params = new URLSearchParams();
  const secret = env.TURNSTILE_SECRET ?? "";
  params.append("secret", secret);
  params.append("response", token);

  const resp = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: params,
    },
  );

  const data: TurnstileResponse = await resp.json();
  return data;
}
