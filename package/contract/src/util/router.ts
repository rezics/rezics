export type HTTPMethod = "GET" | "POST" | "DELETE" | "PATCH";

export type Router<
    TPath extends string,
    TMethod extends HTTPMethod,
    TParameter extends Record<string, any>,
    TBody extends TMethod extends "POST" ? Record<string, any> : never,
    TResponse extends Record<number, any>,
> = {
    path: TPath;
    method: TMethod;
    parameter: TParameter;
    body: TBody;
    response: TResponse;
};
