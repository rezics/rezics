import { graphql, type GraphQLResponseResolver, type RequestHandlerOptions } from "msw";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
    ID: { input: string; output: string };
    String: { input: string; output: string };
    Boolean: { input: boolean; output: boolean };
    Int: { input: number; output: number };
    Float: { input: number; output: number };
};

export type AuthPayload = {
    __typename?: "AuthPayload";
    token: Scalars["String"]["output"];
    user: User;
};

export type BookList = {
    __typename?: "BookList";
    books: Array<Scalars["String"]["output"]>;
    commentsNumber: Scalars["Int"]["output"];
    creator: User;
    description: Scalars["String"]["output"];
    id: Scalars["ID"]["output"];
    likes: Scalars["Int"]["output"];
    title: Scalars["String"]["output"];
};

export type Comment = {
    __typename?: "Comment";
    content: Scalars["String"]["output"];
    createdAt: Scalars["String"]["output"];
    id: Scalars["ID"]["output"];
    likes: Scalars["Int"]["output"];
    replies?: Maybe<Array<Comment>>;
    user: User;
};

export type Mutation = {
    __typename?: "Mutation";
    addComment: Comment;
    addReply: Comment;
    addReview: Review;
    login: AuthPayload;
    register: AuthPayload;
    validateEmail?: Maybe<Array<ValidationError>>;
    validatePassword?: Maybe<Array<ValidationError>>;
};

export type MutationAddCommentArgs = {
    bookListId: Scalars["ID"]["input"];
    content: Scalars["String"]["input"];
};

export type MutationAddReplyArgs = {
    commentId: Scalars["ID"]["input"];
    content: Scalars["String"]["input"];
};

export type MutationAddReviewArgs = {
    bookId: Scalars["ID"]["input"];
    content: Scalars["String"]["input"];
    rating: Scalars["Float"]["input"];
};

export type MutationLoginArgs = {
    email: Scalars["String"]["input"];
    password: Scalars["String"]["input"];
};

export type MutationRegisterArgs = {
    email: Scalars["String"]["input"];
    password: Scalars["String"]["input"];
};

export type MutationValidateEmailArgs = {
    email: Scalars["String"]["input"];
};

export type MutationValidatePasswordArgs = {
    password: Scalars["String"]["input"];
};

export type Query = {
    __typename?: "Query";
    bookList?: Maybe<BookList>;
    bookLists: Array<BookList>;
    bookReviews: Array<Review>;
    comments: Array<Comment>;
    me?: Maybe<User>;
};

export type QueryBookListArgs = {
    id: Scalars["ID"]["input"];
};

export type QueryBookReviewsArgs = {
    bookId: Scalars["ID"]["input"];
};

export type QueryCommentsArgs = {
    bookListId: Scalars["ID"]["input"];
};

export type Review = {
    __typename?: "Review";
    content: Scalars["String"]["output"];
    createdAt: Scalars["String"]["output"];
    id: Scalars["ID"]["output"];
    rating: Scalars["Float"]["output"];
    user: User;
};

export type User = {
    __typename?: "User";
    avatar: Scalars["String"]["output"];
    id: Scalars["ID"]["output"];
    name: Scalars["String"]["output"];
};

export type ValidationError = {
    __typename?: "ValidationError";
    field: Scalars["String"]["output"];
    message: Scalars["String"]["output"];
};

export type LoginMutationVariables = Exact<{
    email: Scalars["String"]["input"];
    password: Scalars["String"]["input"];
}>;

export type LoginMutation = {
    __typename?: "Mutation";
    login: {
        __typename?: "AuthPayload";
        token: string;
        user: { __typename?: "User"; id: string; name: string; avatar: string };
    };
};

export type RegisterMutationVariables = Exact<{
    email: Scalars["String"]["input"];
    password: Scalars["String"]["input"];
}>;

export type RegisterMutation = {
    __typename?: "Mutation";
    register: {
        __typename?: "AuthPayload";
        token: string;
        user: { __typename?: "User"; id: string; name: string; avatar: string };
    };
};

export type ValidateEmailMutationVariables = Exact<{
    email: Scalars["String"]["input"];
}>;

export type ValidateEmailMutation = {
    __typename?: "Mutation";
    validateEmail?: Array<{ __typename?: "ValidationError"; field: string; message: string }> | null;
};

export type ValidatePasswordMutationVariables = Exact<{
    password: Scalars["String"]["input"];
}>;

export type ValidatePasswordMutation = {
    __typename?: "Mutation";
    validatePassword?: Array<{ __typename?: "ValidationError"; field: string; message: string }> | null;
};

export type GetBookListQueryVariables = Exact<{
    id: Scalars["ID"]["input"];
}>;

export type GetBookListQuery = {
    __typename?: "Query";
    bookList?: {
        __typename?: "BookList";
        id: string;
        title: string;
        description: string;
        books: Array<string>;
        likes: number;
        commentsNumber: number;
        creator: { __typename?: "User"; name: string; avatar: string };
    } | null;
};

export type GetCommentsQueryVariables = Exact<{
    bookListId: Scalars["ID"]["input"];
}>;

export type GetCommentsQuery = {
    __typename?: "Query";
    comments: Array<{
        __typename?: "Comment";
        id: string;
        content: string;
        createdAt: string;
        likes: number;
        user: { __typename?: "User"; name: string; avatar: string };
        replies?: Array<{
            __typename?: "Comment";
            id: string;
            content: string;
            createdAt: string;
            likes: number;
            user: { __typename?: "User"; name: string; avatar: string };
        }> | null;
    }>;
};

export type GetBookListsQueryVariables = Exact<{ [key: string]: never }>;

export type GetBookListsQuery = {
    __typename?: "Query";
    bookLists: Array<{
        __typename?: "BookList";
        id: string;
        title: string;
        description: string;
        books: Array<string>;
        likes: number;
        creator: { __typename?: "User"; name: string; avatar: string };
    }>;
};

export type GetBookReviewsQueryVariables = Exact<{
    bookId: Scalars["ID"]["input"];
}>;

export type GetBookReviewsQuery = {
    __typename?: "Query";
    bookReviews: Array<{
        __typename?: "Review";
        id: string;
        content: string;
        rating: number;
        createdAt: string;
        user: { __typename?: "User"; id: string; name: string; avatar: string };
    }>;
};

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockLoginMutation(
 *   ({ query, variables }) => {
 *     const { email, password } = variables;
 *     return HttpResponse.json({
 *       data: { login }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockLoginMutation = (
    resolver: GraphQLResponseResolver<LoginMutation, LoginMutationVariables>,
    options?: RequestHandlerOptions,
) => graphql.mutation<LoginMutation, LoginMutationVariables>("Login", resolver, options);

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockRegisterMutation(
 *   ({ query, variables }) => {
 *     const { email, password } = variables;
 *     return HttpResponse.json({
 *       data: { register }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockRegisterMutation = (
    resolver: GraphQLResponseResolver<RegisterMutation, RegisterMutationVariables>,
    options?: RequestHandlerOptions,
) => graphql.mutation<RegisterMutation, RegisterMutationVariables>("Register", resolver, options);

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockValidateEmailMutation(
 *   ({ query, variables }) => {
 *     const { email } = variables;
 *     return HttpResponse.json({
 *       data: { validateEmail }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockValidateEmailMutation = (
    resolver: GraphQLResponseResolver<ValidateEmailMutation, ValidateEmailMutationVariables>,
    options?: RequestHandlerOptions,
) => graphql.mutation<ValidateEmailMutation, ValidateEmailMutationVariables>("ValidateEmail", resolver, options);

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockValidatePasswordMutation(
 *   ({ query, variables }) => {
 *     const { password } = variables;
 *     return HttpResponse.json({
 *       data: { validatePassword }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockValidatePasswordMutation = (
    resolver: GraphQLResponseResolver<ValidatePasswordMutation, ValidatePasswordMutationVariables>,
    options?: RequestHandlerOptions,
) =>
    graphql.mutation<ValidatePasswordMutation, ValidatePasswordMutationVariables>(
        "ValidatePassword",
        resolver,
        options,
    );

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockGetBookListQuery(
 *   ({ query, variables }) => {
 *     const { id } = variables;
 *     return HttpResponse.json({
 *       data: { bookList }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockGetBookListQuery = (
    resolver: GraphQLResponseResolver<GetBookListQuery, GetBookListQueryVariables>,
    options?: RequestHandlerOptions,
) => graphql.query<GetBookListQuery, GetBookListQueryVariables>("GetBookList", resolver, options);

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockGetCommentsQuery(
 *   ({ query, variables }) => {
 *     const { bookListId } = variables;
 *     return HttpResponse.json({
 *       data: { comments }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockGetCommentsQuery = (
    resolver: GraphQLResponseResolver<GetCommentsQuery, GetCommentsQueryVariables>,
    options?: RequestHandlerOptions,
) => graphql.query<GetCommentsQuery, GetCommentsQueryVariables>("GetComments", resolver, options);

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockGetBookListsQuery(
 *   ({ query, variables }) => {
 *     return HttpResponse.json({
 *       data: { bookLists }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockGetBookListsQuery = (
    resolver: GraphQLResponseResolver<GetBookListsQuery, GetBookListsQueryVariables>,
    options?: RequestHandlerOptions,
) => graphql.query<GetBookListsQuery, GetBookListsQueryVariables>("GetBookLists", resolver, options);

/**
 * @param resolver A function that accepts [resolver arguments](https://mswjs.io/docs/api/graphql#resolver-argument) and must always return the instruction on what to do with the intercepted request. ([see more](https://mswjs.io/docs/concepts/response-resolver#resolver-instructions))
 * @param options Options object to customize the behavior of the mock. ([see more](https://mswjs.io/docs/api/graphql#handler-options))
 * @see https://mswjs.io/docs/basics/response-resolver
 * @example
 * mockGetBookReviewsQuery(
 *   ({ query, variables }) => {
 *     const { bookId } = variables;
 *     return HttpResponse.json({
 *       data: { bookReviews }
 *     })
 *   },
 *   requestOptions
 * )
 */
export const mockGetBookReviewsQuery = (
    resolver: GraphQLResponseResolver<GetBookReviewsQuery, GetBookReviewsQueryVariables>,
    options?: RequestHandlerOptions,
) => graphql.query<GetBookReviewsQuery, GetBookReviewsQueryVariables>("GetBookReviews", resolver, options);
