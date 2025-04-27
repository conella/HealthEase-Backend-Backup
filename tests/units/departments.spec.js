import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";

// Mock the database module (pg) to simulate database interactions
const mockQuery = vi.fn();

// Use `beforeAll` to mock `pg` before any imports
beforeAll(() => {
  vi.mock("pg", () => {
    const mockPool = {
      query: mockQuery,
      connect: vi.fn().mockResolvedValue({}),
      end: vi.fn(),
    };

    return {
      Pool: vi.fn(() => mockPool),
    };
  });
});

// Now import the server after mocking `pg`
let app, server;

beforeAll(async () => {
  ({ app, server } = await import("../../server"));  // Dynamically import server after mock
});

afterAll(() => {
  server.close();  // Close the server after all tests
});

beforeEach(() => {
  vi.clearAllMocks();  // Reset mocks between tests
});

// Grouping all department-related tests
describe("Departments API", () => {
  it("should return a list of all departments", async () => {
    // Mock the behavior for a successful query to fetch departments
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          name: "Neurology",
          description: "Department focused on brain and nervous system disorders.",
        },
        {
          id: 2,
          name: "Cardiology",
          description: "Department specializing in heart and vascular health.",
        },
      ],
    });

    const response = await request(app).get("/api/departments");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toHaveProperty("id", 1);
    expect(response.body[0]).toHaveProperty("name", "Neurology");
    expect(response.body[0]).toHaveProperty(
      "description",
      "Department focused on brain and nervous system disorders."
    );
    expect(response.body[1]).toHaveProperty("id", 2);
    expect(response.body[1]).toHaveProperty("name", "Cardiology");
    expect(response.body[1]).toHaveProperty(
      "description",
      "Department specializing in heart and vascular health."
    );
  });

  it("should return a 500 error if the database query fails", async () => {
    // Mock the behavior for a failed query (simulating an error)
    mockQuery.mockRejectedValueOnce(new Error("Database query failed"));

    const response = await request(app).get("/api/departments");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: "Failed to fetch departments" });
  });
});