import { http, HttpResponse } from "msw";
import { mockUsers, mockTokens } from "../data/auth";

export const authHandlers = [
    // ANCHOR 🟢 REST: POST /auth/login
    http.post("/auth/login", async ({ request }) => {
        const { email, password } = await request.json();
        const user = mockUsers.find((u) => u.email === email && u.password === password);

        if (!user) {
            return HttpResponse.json(
                [
                    {
                        field: "email",
                        message: "Invalid email or password",
                    },
                ],
                { status: 400 },
            );
        }

        return HttpResponse.json({
            token: mockTokens[email as keyof typeof mockTokens],
            user: {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
            },
        });
    }),

    // ANCHOR 🟢 REST: POST /auth/register
    http.post("/auth/register", async ({ request }) => {
        const { email, password } = await request.json();

        if (mockUsers.some((u) => u.email === email)) {
            return HttpResponse.json(
                [
                    {
                        field: "email",
                        message: "Email already exists",
                    },
                ],
                { status: 400 },
            );
        }

        const newUser = {
            id: String(mockUsers.length + 1),
            email,
            password,
            name: email.split("@")[0],
            avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=John",
        };

        mockUsers.push(newUser);
        mockTokens[email as keyof typeof mockTokens] = `mock-jwt-token-${Date.now()}`;

        return HttpResponse.json({
            token: mockTokens[email as keyof typeof mockTokens],
            user: {
                id: newUser.id,
                name: newUser.name,
                avatar: newUser.avatar,
            },
        });
    }),

    // ANCHOR 🟢 REST: GET /auth/me
    http.get("/auth/me", () => {
        return HttpResponse.json({
            id: "user1",
            name: "John Doe",
            avatar: "https://via.placeholder.com/150",
        });
    }),

    // ANCHOR 🟢 REST: POST /validation/email
    http.post("/validation/email", async ({ request }) => {
        const { email } = await request.json();
        const errors: Array<{ field: string; message: string }> = [];

        if (!email) {
            errors.push({
                field: "email",
                message: "电子邮箱不能为空。",
            });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push({
                field: "email",
                message: "请输入有效的电子邮箱地址。",
            });
        }

        return HttpResponse.json(errors);
    }),

    // ANCHOR 🟢 REST: POST /validation/password
    http.post("/validation/password", async ({ request }) => {
        const { password } = await request.json();
        const errors: Array<{ field: string; message: string }> = [];

        if (!password) {
            errors.push({
                field: "password",
                message: "密码不能为空。",
            });
        } else if (password.length < 6) {
            errors.push({
                field: "password",
                message: "密码长度至少为6位。",
            });
        }

        return HttpResponse.json(errors);
    }),
];
