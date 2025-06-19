// src/mocks/handlers.ts
import { graphql, HttpResponse } from "msw";
// import { GetBooksDocument, AddBookDocument } from '@/graphql/generated'; // 注意路径
import { mockReviews, mockUsers as reviewUsers } from "./data/reviews";
import { mockBookLists } from "./data/booklists";
import { mockComment01 } from "./data/comment01";
import { mockABookList01 } from "./data/abooklist01";
import { mockUsers, mockTokens } from "./data/auth";

export const handlers = [
    // 🟢 Query: GetBooks
    graphql.query("GetBooksDocument", ({ variables }) => {
        return HttpResponse.json({
            data: {
                books: [
                    { id: "1", title: "Mock Book 1", author: "Author A" },
                    { id: "2", title: "Mock Book 2", author: "Author B" },
                ],
            },
        });
    }),

    // 🟢 Query: GetBookReviews
    graphql.query("GetBookReviews", ({ variables }) => {
        const { bookId } = variables;
        const reviews = mockReviews
            .filter((review) => review.bookId === bookId)
            .map((review) => ({
                ...review,
                user: reviewUsers.find((user) => user.id === review.userId),
            }));

        return HttpResponse.json({
            data: {
                bookReviews: reviews,
            },
        });
    }),

    // 🟢 Query: GetBookLists
    graphql.query("GetBookLists", () => {
        return HttpResponse.json({
            data: {
                bookLists: mockBookLists,
            },
        });
    }),

    // 🟢 Query: GetBookList
    graphql.query("GetBookList", ({ variables }) => {
        const { id } = variables;

        // // Since mockABookList01 is a single object, we just need to check if the id matches
        // if (mockABookList01.id !== parseInt(id)) {
        //   return HttpResponse.json({
        //     data: {
        //       bookList: null
        //     }
        //   });
        // }

        return HttpResponse.json({
            data: { bookList: mockABookList01 },
        });
    }),

    // 🟢 Query: GetComments
    graphql.query("GetComments", ({ variables }) => {
        const { bookListId } = variables;
        return HttpResponse.json({
            data: {
                comments: mockComment01,
            },
        });
    }),

    // 🟢 Mutation: Login
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
                    token: mockTokens[email],
                    user: {
                        id: user.id,
                        name: user.name,
                        avatar: user.avatar,
                    },
                },
            },
        });
    }),

    // 🟢 Mutation: Register
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
        mockTokens[email] = `mock-jwt-token-${Date.now()}`;

        return HttpResponse.json({
            data: {
                register: {
                    token: mockTokens[email],
                    user: {
                        id: newUser.id,
                        name: newUser.name,
                        avatar: newUser.avatar,
                    },
                },
            },
        });
    }),

    // 🟢 Mutation: ValidateEmail
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

    // 🟢 Mutation: ValidatePassword
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

    // 🟢 Mutation: AddBook
    graphql.mutation("AddBookDocument", async ({ variables }) => {
        const { title, author } = variables;

        return HttpResponse.json({
            data: {
                addBook: {
                    id: String(Math.floor(Math.random() * 10000)),
                    title,
                    author,
                },
            },
        });
    }),
];
