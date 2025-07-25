import s from "./s";
import c from "contract";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] || "your-secret-key";
const JWT_REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"] || "your-refresh-secret-key";

interface TokenPayload {
    userId: string;
    email: string;
}

const generateTokens = (payload: TokenPayload) => {
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
    return { accessToken, refreshToken };
};

// Mock users for development (in production, use proper password hashing)
const mockUsers = new Map<string, {
    id: string;
    email: string;
    name: string;
    password: string; // In production, this should be hashed
}>();

// Add a default test user
mockUsers.set("test@example.com", {
    id: "user_1",
    email: "test@example.com",
    name: "Test User",
    password: "password123" // In production, this should be hashed
});

export default s.router(c.Auth, {
    login: async ({ body }: { body: any }) => {
        try {
            const { email, password } = body;
            
            // Find user by email (mock implementation)
            const user = mockUsers.get(email);

            if (!user) {
                return {
                    status: 401,
                    body: { message: "Invalid credentials" }
                };
            }
            
            // Simple password check (in production, use bcrypt)
            if (user.password !== password) {
                return {
                    status: 401,
                    body: { message: "Invalid credentials" }
                };
            }

            // Generate tokens
            const { accessToken } = generateTokens({
                userId: user.id,
                email: user.email
            });

            return {
                status: 200,
                body: {
                    token: accessToken,
                    user: {
                        id: user.id,
                        username: user.name,
                        email: user.email,
                        name: user.name,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };
        } catch (error) {
            console.error("Login error:", error);
            return {
                status: 401,
                body: { message: "Login failed" }
            };
        }
    },

    register: async ({ body }: { body: any }) => {
        try {
            const { email, password } = body;
            
            // Check if user already exists
            if (mockUsers.has(email)) {
                return {
                    status: 400,
                    body: { message: "User already exists" }
                };
            }

            // Create user (in production, hash the password)
            const userId = `user_${Date.now()}`;
            const newUser = {
                id: userId,
                email,
                name: email.split('@')[0],
                password // In production, hash this
            };

            mockUsers.set(email, newUser);

            // Generate tokens
            const { accessToken } = generateTokens({
                userId: newUser.id,
                email: email
            });

            return {
                status: 200,
                body: {
                    token: accessToken,
                    user: {
                        id: newUser.id,
                        username: newUser.name,
                        email: newUser.email,
                        name: newUser.name,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                }
            };
        } catch (error) {
            console.error("Registration error:", error);
            return {
                status: 400,
                body: { message: "Registration failed" }
            };
        }
    },

    refresh: async ({ body }: { body: any }) => {
        try {
            const { refreshToken } = body;
            
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as TokenPayload;
            
            // Generate new access token
            const { accessToken, refreshToken: newRefreshToken } = generateTokens({
                userId: decoded.userId,
                email: decoded.email
            });

            return {
                status: 200,
                body: {
                    accessToken,
                    refreshToken: newRefreshToken
                }
            };
        } catch (error) {
            console.error("Token refresh error:", error);
            return {
                status: 401,
                body: { message: "Invalid refresh token" }
            };
        }
    },
});
