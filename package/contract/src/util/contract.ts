import { Filter } from "./filter";
import { Result, Select } from "./select";

export type HTTPMethod = "GET" | "POST" | "DELETE" | "PATCH";

export type JSONScalar = string | number | boolean | null;
export type JSONArray = JSONValue[];
export type JSONShallowObject = { [Key: string]: JSONScalar };
export type JSONObject = { [Key: string]: JSONValue };
export type JSONValue = JSONScalar | JSONArray | JSONObject;

export type Parameter = object;

export type Response = {
    [Code: number]: any;
};

export type Contract<
    TBase extends JSONValue = JSONValue,
    TErrorResponse extends Response = Response,
    TSelected extends Select<TBase> = Select<TBase>,
> = {
    in: {
        method: HTTPMethod;
        params: JSONObject;
        select: TSelected;
        filter: Filter<Result<TBase, TSelected>>;
    };
    out: {
        success: Result<TBase, TSelected>;
        failure: TErrorResponse;
    };
};
