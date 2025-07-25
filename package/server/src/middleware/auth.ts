import jwt from "jsonwebtoken";
import type { FastifyRequest, FastifyReply } from "fastify";

const JWT_SECRET = process.env["JWT_SECRET"] || "your-secret-key";

export interface AuthenticatedUser {
    userId: string;
    email: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
    user?: AuthenticatedUser;
}

export const authenticateToken = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
) => {
    try {
        const authHeader = request.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];

        if (!token) {
            return reply.status(401).send({ message: "Access token required" });
        }

        const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
        request.user = decoded;
    } catch (error) {
        return reply.status(403).send({ message: "Invalid or expired token" });
    }
};

export const optionalAuth = async (
    request: AuthenticatedRequest,
    _reply: FastifyReply
) => {
    try {
        const authHeader = request.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];

        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
            request.user = decoded;
        }
    } catch (error) {
        // Optional auth - continue without user context
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.log("Optional auth failed:", errorMessage);
    }
};