import { api } from "encore.dev/api";

interface HealthResponse {
  status: string;
  message: string;
  timestamp: Date;
  version: string;
}

// Simple health check that doesn't depend on database
export const health = api(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<HealthResponse> => {
    return {
      status: "ok",
      message: "Library Book Backend is running successfully with Encore!",
      timestamp: new Date(),
      version: "1.0.0-encore",
    };
  }
);

// Simple test endpoint
interface TestResponse {
  message: string;
  services: string[];
}

export const test = api(
  { expose: true, method: "GET", path: "/test" },
  async (): Promise<TestResponse> => {
    return {
      message: "All services migrated successfully to Encore!",
      services: [
        "users",
        "posts",
        "books",
        "comments",
        "tags",
        "stats",
        "reactions",
        "health",
      ],
    };
  }
);
