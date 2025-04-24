import request from "supertest";
import { describe, it, expect, vi, afterAll } from "vitest";
import cookieParser from "cookie-parser";
import { app, server } from "../../server";

// Middleware
app.use(cookieParser());

// Mock `pg` module
vi.mock("pg", () => {
  const mockQuery = vi.fn();

  mockQuery.mockImplementation((sql, values) => {
    if (sql.includes("SELECT") && values?.[0] === "johndoe") {
      return Promise.resolve({
        rows: [{ username: "johndoe" }],
      });
    }

    if (sql.includes("SELECT") && values?.includes("wronguser")) {
      return Promise.resolve({ rows: [] });
    }

    if (sql.includes("INSERT")) {
      return Promise.resolve(); // Simulate success
    }

    return Promise.resolve({ rows: [] });
  });

  const mockPool = {
    query: mockQuery,
    connect: vi.fn().mockResolvedValue({}), // Mock `connect` to return an empty object
    end: vi.fn(),
  };

  return {
    // Mock Pool constructor as a function that returns mockPool
    Pool: vi.fn(() => mockPool),
  };
});

// Mock `bcrypt` module
vi.mock("bcrypt", async () => {
  const originalBcrypt = await import("bcrypt");
  return {
    ...originalBcrypt,
    compare: vi.fn((plainPassword, hashedPassword) => {
      if (!plainPassword || !hashedPassword) {
        throw new Error("data and hash arguments required");
      }

      if (plainPassword === "wrongpass") {
        return Promise.resolve(false); // Invalid password
      }

      return Promise.resolve(true); // Valid password
    }),
    hash: vi.fn().mockResolvedValue("hashed-password"), // Mock password hashing
  };
});

describe("Auth API", () => {
  afterAll(() => {
    server.close(); // Close server after tests
  });

  it("should return 401 when logging in with invalid credentials", async () => {
    const response = await request(app)
      .post("/login")
      .send({ username: "wronguser", password: "wrongpass" });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Invalid credentials");
  });

  it("should throw an error if attempt to register with the same username", async () => {
    const response = await request(app).post("/register").send({
      username: "johndoe",
      password: "password123",
      firstName: "Test",
      lastName: "User",
    });

    console.log("Register Response:", response.body);

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Username already exists");
  });

  it("should return 401 on protected route without token", async () => {
    const response = await request(app).get("/protected");
    expect(response.statusCode).toBe(401);
  });
});
