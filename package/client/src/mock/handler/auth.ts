import { http, HttpResponse } from "msw";
// import { Auth } from "contract";
import { mockTokens, mockUsers } from "../data/auth.ts";

export const authHandlers = [
    // Login
    http.post(Auth.login.path, async ({ request }) => {
        const { email, password } = (await request.json()) as {
            email: string;
            password: string;
        };

        const user = mockUsers.find(
            (u) => u.email === email && u.password === password,
        );

        if (!user) {
            return HttpResponse.json(
                { message: "Invalid email or password" },
                { status: 401 },
            );
        }

        const tokenKey = email as keyof typeof mockTokens;
        const token = mockTokens[tokenKey] ?? `mock-jwt-token-${Date.now()}`;
        mockTokens[tokenKey] = token;

        return HttpResponse.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
            },
        });
    }),

    // Register
    http.post(Auth.register.path, async ({ request }) => {
        const { email, password } = (await request.json()) as {
            email: string;
            password: string;
        };

        if (mockUsers.some((u) => u.email === email)) {
            return HttpResponse.json(
                { message: "Email already exists" },
                { status: 400 },
            );
        }

        const newUser = {
            id: String(mockUsers.length + 1),
            email,
            password,
            name: email.split("@")[0] ?? "user",
            avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=User",
        };
        mockUsers.push(newUser);
        const token = `mock-jwt-token-${Date.now()}`;
        mockTokens[email as keyof typeof mockTokens] = token;

        return HttpResponse.json({
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                avatar: newUser.avatar,
            },
        });
    }),

    // Refresh token
    http.post(Auth.refresh.path, async ({ request }) => {
        const { refreshToken } = (await request.json()) as {
            refreshToken?: string;
        };
        if (!refreshToken) {
            return HttpResponse.json(
                { message: "Invalid refresh token" },
                { status: 401 },
            );
        }
        const newAccessToken = `mock-jwt-token-${Date.now()}`;
        return HttpResponse.json({ accessToken: newAccessToken, refreshToken });
    }),
];
