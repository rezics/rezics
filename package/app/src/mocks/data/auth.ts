export const mockUsers = [
  {
    id: "1",
    email: "test@example.com",
    password: "password123", // In real app, this would be hashed — 真实应用中这里应当是哈希值
    name: "Test User",
    avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=John",
  },
];

export const mockTokens = {
  "test@example.com": "mock-jwt-token-123",
};
