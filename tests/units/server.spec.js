import request from "supertest";
import { describe, it, expect, vi, afterAll } from "vitest";
import cookieParser from "cookie-parser";
import { app, server } from "../../server";

app.use(cookieParser());

// Mock pkg module
vi.mock("pkg", async () => {
  const mockQuery = vi.fn();

  const mockRequest = {
    input: vi.fn().mockReturnThis(),
    query: mockQuery,
  };

  const mockSql = {
    query: vi.fn((queryStr, params) => {

      // Simulate finding a user with the given username (testuser)
      if (queryStr.includes("FROM users WHERE username = @username")) {
        if (params.username === "testuser") {
          return Promise.resolve({
            recordset: [{ username: "testuser", password: "hashed-password" }],
          });
        }
      }

      return Promise.resolve({ recordset: [] });
    }),
    Request: vi.fn(() => mockRequest),
    NVarChar: vi.fn(),
  };

  return {
    ...mockSql,
    default: mockSql,
  };
});

// Mock bcrypt module
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
    hash: vi.fn().mockResolvedValue("hashed-password"),
  };
});

describe("Auth API", () => {
  afterAll(() => {
    server.close();
  });

  it("should return 401 when logging in with invalid credentials", async () => {
    const response = await request(app)
      .post("/login")
      .send({ username: "wronguser", password: "wrongpass" });

    // Check that the response is 401 and the message is correct
    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Invalid credentials");
  });

  it("Should throw an error if attempt to register with the same username", async () => {
    const response = await request(app).post("/register").send({
      username: "johndoe",
      password: "password123",
      firstName: "Test",
      lastName: "User",
    });
  
    // Log the response for debugging purposes
    console.log("Register Response:", response.body);
  
    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Username already exists");
  });
  

  it("should return 401 on protected route without token", async () => {
    const response = await request(app).get("/protected");
    expect(response.statusCode).toBe(401);
  });
});
