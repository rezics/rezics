import type { AuthResponse, SignOutResponse } from "@rezics/contract";
import {
  authSignInClient,
  unwrapEdenProxyResponse,
} from "@/lib/api-client";

export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await authSignInClient["sign-in"].email.post(input);
  return unwrapEdenProxyResponse<AuthResponse>(response);
}

export async function signOutAuthSession(): Promise<SignOutResponse> {
  const response = await authSignInClient["sign-out"].post();
  return unwrapEdenProxyResponse<SignOutResponse>(response);
}
