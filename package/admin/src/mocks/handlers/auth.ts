import { graphql, HttpResponse } from "msw";
import type { HandlerResolver } from "./types";
import { mockUsers, mockTokens } from "../data/auth"; // Adjusted path

export const authHandlers = [
    // 🟢 Query: GetMe
    graphql.query("GetMe", (({ query, variables }) => {
        // Use HandlerResolver signature
        // Assuming mockUsers is an array and we take the first as 'me'
        if (mockUsers.length > 0) {
            return HttpResponse.json({ data: { me: mockUsers[0] } });
        }
        return HttpResponse.json({ data: { me: null } }, { status: 404 });
    }) as HandlerResolver),

    // 🟢 Mutation: Login
    graphql.mutation("Login", (({ variables }) => {
        const { email, password } = variables as { email?: string; password?: string }; // Type assertion
        const user = mockUsers.find((u) => u.email === email && u.password === password);

        if (!user || !email) {
            // ensure email is defined for mockTokens
            return HttpResponse.json(
                {
                    errors: [
                        {
                            message: "Invalid email or password",
                            path: ["login"],
                        },
                    ],
                },
                { status: 401 },
            );
        }

        return HttpResponse.json({
            data: {
                login: {
                    // Ensure email is a valid key for mockTokens
                    token: mockTokens[email as keyof typeof mockTokens] || "fallback-token",
                    user: {
                        id: user.id,
                        name: user.name,
                        avatar: user.avatar,
                    },
                },
            },
        });
    }) as HandlerResolver),

    // 🟢 Mutation: Register
    graphql.mutation("Register", (({ variables }) => {
        const { email, password } = variables as { email?: string; password?: string };

        if (!email || !password) {
            return HttpResponse.json({ errors: [{ message: "Email and password are required." }] }, { status: 400 });
        }

        if (mockUsers.some((u) => u.email === email)) {
            return HttpResponse.json(
                {
                    errors: [
                        {
                            message: "Email already exists",
                            path: ["register"],
                        },
                    ],
                },
                { status: 400 },
            );
        }

        const newUser = {
            id: String(mockUsers.length + 1),
            email,
            password, // In a real app, hash this password
            name: email.split("@")[0],
            avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=John",
        };

        mockUsers.push(newUser);
        // Ensure mockTokens can be indexed by string
        (mockTokens as Record<string, string>)[email] = `mock-jwt-token-${Date.now()}`;

        return HttpResponse.json({
            data: {
                register: {
                    token: (mockTokens as Record<string, string>)[email],
                    user: {
                        id: newUser.id,
                        name: newUser.name,
                        avatar: newUser.avatar,
                    },
                },
            },
        });
    }) as HandlerResolver),

    // 🟢 Mutation: ValidateEmail
    graphql.mutation("ValidateEmail", (({ variables }) => {
        const { email } = variables as { email?: string };
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

        return HttpResponse.json({
            data: {
                validateEmail: errors,
            },
        });
    }) as HandlerResolver),

    // 🟢 Mutation: ValidatePassword
    graphql.mutation("ValidatePassword", (({ variables }) => {
        const { password } = variables as { password?: string };
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

        return HttpResponse.json({
            data: {
                validatePassword: errors,
            },
        });
    }) as HandlerResolver),
];
