import { restClient } from "../plugin/providers/rest";

// Types
export interface AuthPayload {
    token: string;
    user: {
        id: string;
        name: string;
        avatar: string;
    };
}

export interface ValidationError {
    field: string;
    message: string;
}

// API functions
export const login = async (email: string, password: string): Promise<AuthPayload> => {
    return restClient.post<AuthPayload>("/auth/login", { email, password });
};

export const register = async (email: string, password: string): Promise<AuthPayload> => {
    return restClient.post<AuthPayload>("/auth/register", { email, password });
};

export const validateEmail = async (email: string): Promise<ValidationError[]> => {
    return restClient.post<ValidationError[]>("/validation/email", { email });
};

export const validatePassword = async (password: string): Promise<ValidationError[]> => {
    return restClient.post<ValidationError[]>("/validation/password", { password });
};

export const getMe = async (): Promise<{ id: string; name: string; avatar: string }> => {
    return restClient.get("/auth/me");
};
