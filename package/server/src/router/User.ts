import { setup } from "./setup";
import User from "contract/router/User";
import type { Executor } from "gel";
import { Config } from "../config";

// Get configuration from environment variables
const config = Config.parse(process.env);

// Manual type definitions for User database operations
// These would normally be auto-generated

type UserCreateArgs = {
    readonly name: string;
    readonly email: string;
    readonly description?: string | null;
};

type UserCreateReturns = {
    id: string;
    name: string;
    email: string;
    description: string | null;
    created_at: Date;
    updated_at: Date;
};

type UserReadArgs = {
    readonly id?: string;
    readonly name?: string;
    readonly email?: string;
};

type UserReadReturns = {
    id: string;
    name: string;
    email: string;
    description: string | null;
    created_at: Date;
    updated_at: Date;
    friends: Array<{
        id: string;
        name: string;
    }>;
    owned_tags: Array<{
        id: string;
        name: string;
        type: string;
    }>;
    owned_favorites: Array<{
        id: string;
    }>;
};

type CheckPasswordArgs = {
    readonly email?: string;
    readonly username?: string;
    readonly password: string;
};

type CheckPasswordReturns = {
    id: string;
    password_valid: boolean;
    user: {
        id: string;
        name: string;
        email: string;
        description: string | null;
        created_at: Date;
        updated_at: Date;
    };
};

// Database query functions
function UserCreate(client: Executor, args: UserCreateArgs): Promise<UserCreateReturns> {
    return client.queryRequiredSingle(`
select (
    insert User {
        name := <str>$name,
        email := <str>$email,
        description := <optional str>$description,
    }
) {
    id,
    name,
    email,
    description,
    created_at,
    updated_at
}`, args);
}

function UserRead(client: Executor, args: UserReadArgs): Promise<UserReadReturns | null> {
    return client.querySingle(`
select User {
    id,
    name,
    email,
    description,
    created_at,
    updated_at,
    friends: {
        id,
        name
    },
    owned_tags: {
        id,
        name,
        type
    },
    owned_favorites: {
        id
    }
}
filter (
    (.id = <optional uuid>$id) ??
    (.name = <optional str>$name) ??
    (.email = <optional str>$email)
)`, args);
}

function CheckPassword(client: Executor, args: CheckPasswordArgs): Promise<CheckPasswordReturns | null> {
    return client.querySingle(`
select Identification {
    id,
    password_valid := ext::pgcrypto::crypt(<str>$password, .password_hash) = .password_hash,
    user: {
        id,
        name,
        email,
        description,
        created_at,
        updated_at
    }
}
filter (
    (.user.email = <optional str>$email) or
    (.user.name = <optional str>$username)
)`, args);
}

function CreateIdentification(
    client: Executor, 
    args: { 
        user_id: string; 
        password: string;
        hash_algorithm?: string;
        salt_rounds?: number;
        custom_salt?: string;
    }
): Promise<{id: string}> {
    // Use environment variables as defaults, allow override via args
    const { 
        user_id, 
        password, 
        hash_algorithm = config.password_hash_algorithm,
        salt_rounds = config.password_salt_rounds,
        custom_salt = config.password_custom_salt
    } = args;
    
    // Generate salt based on parameters
    let saltQuery: string;
    if (custom_salt) {
        saltQuery = `<str>$custom_salt`;
    } else {
        saltQuery = `ext::pgcrypto::gen_salt(<str>$hash_algorithm, <int32>$salt_rounds)`;
    }
    
    return client.queryRequiredSingle(`
select (
    insert Identification {
        user := (select User filter .id = <uuid>$user_id),
        password_hash := ext::pgcrypto::crypt(<str>$password, ${saltQuery})
    }
) {
    id
}`, { user_id, password, hash_algorithm, salt_rounds, custom_salt });
}

export default setup(({ gel, tsr }) =>
    tsr.router(User, {
        create: async ({ body }) => {
            try {
                const user = await UserCreate(gel, {
                    name: body.name, // Use name as username for now
                    email: body.email,
                    description: null,
                });

                return {
                    status: 201,
                    body: {
                        id: user.id,
                        username: user.name, // Map name to username for contract compatibility
                        email: user.email,
                        name: user.name,
                        phone: body.phone || null,
                        avatar: body.avatar,
                        description: user.description,
                        created_at: user.created_at,
                        updated_at: user.updated_at,
                    },
                };
            } catch (error) {
                return {
                    status: 500,
                    body: { error: String(error) },
                };
            }
        },

        read: async ({ params, query }) => {
            try {
                const user = await UserRead(gel, {
                    id: params.id,
                    name: query?.username,
                    // Note: query.email doesn't exist in User.Read schema, using name instead
                });

                if (!user) {
                    return {
                        status: 404,
                        body: { error: "User not found" },
                    };
                }

                return {
                    status: 200,
                    body: {
                        id: user.id,
                        username: user.name,
                        email: user.email,
                        name: user.name,
                        phone: null,
                        avatar: null,
                        description: user.description,
                        created_at: user.created_at,
                        updated_at: user.updated_at,
                    },
                };
            } catch (error) {
                return {
                    status: 500,
                    body: { error: String(error) },
                };
            }
        },

        signup: async ({ body }) => {
            try {
                // Create user first
                const user = await UserCreate(gel, {
                    name: body.username,
                    email: body.email,
                    description: null,
                });

                // Create identification record with hashed password
                await CreateIdentification(gel, {
                    user_id: user.id,
                    password: body.password,
                });

                return {
                    status: 201,
                    body: {
                        id: user.id,
                        username: user.name,
                        email: user.email,
                        name: user.name,
                        phone: body.phone || null,
                        avatar: null,
                        description: user.description,
                        created_at: user.created_at,
                        updated_at: user.updated_at,
                    },
                };
            } catch (error) {
                return {
                    status: 500,
                    body: { error: String(error) },
                };
            }
        },

        login: async ({ body }) => {
            try {
                const result = await CheckPassword(gel, {
                    email: body.email,
                    username: body.username,
                    password: body.password,
                });

                if (!result) {
                    return {
                        status: 401,
                        body: { error: "User not found" },
                    };
                }

                if (!result.password_valid) {
                    return {
                        status: 401,
                        body: { error: "Invalid password" },
                    };
                }

                // In a real implementation, you'd generate a JWT token here
                const token = `mock-jwt-token-${result.user.id}`;

                return {
                    status: 200,
                    body: {
                        user: {
                            id: result.user.id,
                            username: result.user.name,
                            email: result.user.email,
                            name: result.user.name,
                            phone: null,
                            avatar: null,
                            description: result.user.description,
                            created_at: result.user.created_at,
                            updated_at: result.user.updated_at,
                        },
                        token,
                    },
                };
            } catch (error) {
                return {
                    status: 500,
                    body: { error: String(error) },
                };
            }
        },

        update: async ({ params, body }) => {
            // TODO: Implement user update
            return {
                status: 501,
                body: { error: "Not implemented" },
            };
        },

        delete: async ({ params }) => {
            // TODO: Implement user deletion
            return {
                status: 501,
                body: null,
            };
        },

        profile: async ({ headers }) => {
            // TODO: Implement profile retrieval (requires auth middleware)
            return {
                status: 501,
                body: { error: "Not implemented - requires authentication" },
            };
        },

        list: async ({ query }) => {
            // TODO: Implement user listing with pagination
            return {
                status: 501,
                body: { error: "Not implemented" },
            };
        },

        getUserBooks: async ({ params }) => {
            // TODO: Implement get user books
            return {
                status: 501,
                body: { error: "Not implemented" },
            };
        },

        getUserReadLists: async ({ params }) => {
            // TODO: Implement get user read lists
            return {
                status: 501,
                body: { error: "Not implemented" },
            };
        },

        getUserReviews: async ({ params, query }) => {
            // TODO: Implement get user reviews
            return {
                status: 501,
                body: { error: "Not implemented" },
            };
        },
    }),
);
