// import { describe, it, expect } from "vitest";
// // Use Encore's generated testing client to call the endpoint in-process.
// // @ts-expect-error allow js
// import { health as healthEndpoint, test as testEndpoint } from "~encore/internal/clients/health/endpoints_testing.js";

// describe("health service", () => {
//   it("returns ok status", async () => {
//     const res = await healthEndpoint({});
//     expect(res).toBeTruthy();
//     expect(res.status).toBe("ok");
//     expect(res.message).toContain("Library Book Backend");
//     expect(res.version).toBe("1.0.0-encore");
//     expect(res.timestamp).toBeInstanceOf(Date);
//   });

//   it("test endpoint lists services including health", async () => {
//     const res = await testEndpoint({});
//     expect(res).toBeTruthy();
//     expect(res.message).toContain("migrated successfully");
//     expect(Array.isArray(res.services)).toBe(true);
//     expect(res.services).toContain("health");
//     expect(res.services).toContain("books");
//     expect(res.services).toContain("users");
//   });
// });


