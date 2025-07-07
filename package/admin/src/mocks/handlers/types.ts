import type { GraphQLResponseResolver } from "msw";
// import type { DocumentNode } from 'graphql';

export type HandlerResolver = GraphQLResponseResolver<any, Record<string, any>>;

export interface MockContext {
    delay?: number;
    status?: number;
    errors?: Array<{ message: string; path?: string[] }>;
}
