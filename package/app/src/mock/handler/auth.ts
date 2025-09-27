import { http, HttpResponse } from "msw";
import { mockTokens, mockUsers } from "../data/auth.ts";

// Align with src/api/auth.ts (base `/auth/...`)
export const authHttpHandlers = [
  // Login
  http.post("/auth/login", async ({ request }) => {
    const { email, password } = (await request.json()) as {
      email: string;
      password: string;
    };

    const user = mockUsers.find((u) => u.email === email && u.password === password);

    if (!user) {
      return HttpResponse.json({ message: "Invalid email or password" }, { status: 401 });
    }

    const tokenKey = email as keyof typeof mockTokens;
    const accessToken = mockTokens[tokenKey] ?? `mock-jwt-token-${Date.now()}`;
    const refreshToken = `mock-refresh-token-${Date.now()}`;
    mockTokens[tokenKey] = accessToken;

    return HttpResponse.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, avatar: user.avatar },
    });
  }),

  // Refresh token
  http.post("/auth/refresh", async ({ request }) => {
    const { refreshToken } = (await request.json()) as { refreshToken?: string };
    if (!refreshToken) {
      return HttpResponse.json({ message: "Invalid refresh token" }, { status: 401 });
    }
    const accessToken = `mock-jwt-token-${Date.now()}`;
    return HttpResponse.json({ accessToken, refreshToken });
  }),
];
