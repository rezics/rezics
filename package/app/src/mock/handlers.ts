// src/mocks/handlers.ts
import { graphql, HttpResponse } from "msw";
// import { GetBooksDocument, AddBookDocument } from '@/graphql/generated'; // 注意路径
import { mockReviews, mockUsers as reviewUsers } from "./data/reviews";
import { mockBookLists } from "./data/booklists";
import { mockCommentTree01 } from "./data/comment01";
import { mockABookList01 } from "./data/abooklist01";
import { mockUsers, mockTokens } from "./data/auth";
import { bookInfo01, authorInfo01 } from "./data/bookinfo01";
import { mockQuotes } from "./data/mockQuotes";

export const handlers = [
    // ANCHOR BOOK
    // ANCHOR 🟢 Query: BookInfoQuery
    graphql.query("BookInfoQuery", ({ variables }) => {
        return HttpResponse.json({
            data: {
                book: bookInfo01,
                author: authorInfo01,
            },
        });
    }),

    // ANCHOR 🟢 Query: GetBooks
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

    // ANCHOR 🟢 Query: QuoteExcerptQuery
    graphql.query("QuoteExcerptQuery", ({ variables }) => {
        return HttpResponse.json({
            data: {
                quotes: mockQuotes,
            },
        });
    }),

    // ANCHOR 🟢 Query: GetBookReviews
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

    // ANCHOR BOOKLIST
    // ANCHOR 🟢 Query: bookListsQuery
    graphql.query("bookListsQuery", () => {
        return HttpResponse.json({
            data: {
                bookLists: mockBookLists,
            },
        });
    }),

    // ANCHOR 🟢 Query: GetBookList
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

    // ANCHOR 🟢 Query: GetComments
    graphql.query("GetComments", ({ variables }) => {
        const { bookListId } = variables;
        return HttpResponse.json({
            data: {
                comments: mockCommentTree01,
            },
        });
    }),

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

    // ANCHOR 🟢 Mutation: AddBook
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
    // ANCHOR ⚠️ fallback handler - 捕捉未拦截的请求
    graphql.operation((req) => {
        console.warn(`[MSW] ⚠️ Unhandled GraphQL operation: ${req.operationName}`);
        return HttpResponse.json(
            { errors: [{ message: `No mock handler for operation: ${req.operationName}` }] },
            { status: 400 }
        );
    }),
];
