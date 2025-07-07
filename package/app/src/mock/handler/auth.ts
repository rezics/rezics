import { graphql, HttpResponse } from "msw";
import { mockUsers, mockTokens } from "../data/auth";

export const authHandlers = [
    // ANCHOR 🟢 Mutation: Login
    graphql.mutation("Login", ({ variables }) => {
        const { email, password } = variables;
        const user = mockUsers.find((u) => u.email === email && u.password === password);

        if (!user) {
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
                    token: mockTokens[email as keyof typeof mockTokens],
                    user: {
                        id: user.id,
                        name: user.name,
                        avatar: user.avatar,
                    },
                },
            },
        });
    }),

    // ANCHOR 🟢 Mutation: Register
    graphql.mutation("Register", ({ variables }) => {
        const { email, password } = variables;

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
            password,
            name: email.split("@")[0],
            avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=John",
        };

        mockUsers.push(newUser);
        mockTokens[email as keyof typeof mockTokens] = `mock-jwt-token-${Date.now()}`;

        return HttpResponse.json({
            data: {
                register: {
                    token: mockTokens[email as keyof typeof mockTokens],
                    user: {
                        id: newUser.id,
                        name: newUser.name,
                        avatar: newUser.avatar,
                    },
                },
            },
        });
    }),

    // ANCHOR 🟢 Mutation: ValidateEmail
    graphql.mutation("ValidateEmail", ({ variables }) => {
        const { email } = variables;
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
    }),

    // ANCHOR 🟢 Mutation: ValidatePassword
    graphql.mutation("ValidatePassword", ({ variables }) => {
        const { password } = variables;
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
    }),
];
