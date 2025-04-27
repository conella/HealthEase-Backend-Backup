import request from "supertest";
import { describe, it, expect, vi, afterAll } from "vitest";
import cookieParser from "cookie-parser";
import { app, server } from "../../server";
import jwt from "jsonwebtoken";

// Mocking the pg module (PostgreSQL) to simulate database interactions
vi.mock("pg", () => {
  const mockQuery = vi.fn();

  mockQuery.mockImplementation((sql, values) => {
    // Simulate the response for 'Mary' username in the database
    if (sql.includes("SELECT") && values?.includes("Mary")) {
      return Promise.resolve({
        rows: [
          {
            username: "Mary",
            password:
              "$2b$10$sk6oVzIRMYJck.hD1kloVOTEksyJSM2ICWl06pAkydSn1MxmRWmGS", // Mary's hashed password - Test user in db for test purposes
            id: 1,
            role: "patient",
            firstName: "Mary",
            lastName: "Campbell",
            email: "marycampbell@gmail.com",
            phone: "123456789",
          },
        ],
      });
    }

    // If a wrong username is passed (e.g. 'wronguser'), simulate an empty response
    if (sql.includes("SELECT") && values?.includes("wronguser")) {
      return Promise.resolve({ rows: [] });
    }

    return Promise.resolve({ rows: [] });
  });

  const mockPool = {
    query: mockQuery,
    connect: vi.fn().mockResolvedValue({}),
    end: vi.fn(),
  };

  return {
    Pool: vi.fn(() => mockPool),
  };
});

// Mocking the bcrypt module (to avoid real password hashing and comparison)
vi.mock("bcrypt", async () => {
  const originalBcrypt = await import("bcrypt");
  return {
    ...originalBcrypt,
    compare: vi.fn((plainPassword, hashedPassword) => {
      // Simulate password comparison logic: check if plainPassword matches the hashed password
      if (
        plainPassword === "password123" &&
        hashedPassword === "hashed-password"
      ) {
        return Promise.resolve(true); // Passwords match
      }

      return Promise.resolve(false); // Passwords don't match
    }),
    hash: vi.fn().mockResolvedValue("hashed-password"), // Mock password hashing
  };
});

// Middleware for cookie parsing
app.use(cookieParser());

// Grouping all authentication-related tests under "Auth API"
describe("Auth API", () => {
  afterAll(() => {
    server.close(); // Close the server after all tests are completed
  });

  // Test case for invalid login credentials
  it("should return 401 when logging in with invalid credentials", async () => {
    const response = await request(app)
      .post("/login")
      .send({ username: "wronguser", password: "wrongpass" });

    expect(response.statusCode).toBe(401); // Expect 401 for invalid login
    expect(response.body.message).toBe("Invalid credentials"); // Correct error message
  });

  // Test case for trying to register with an existing username
  it("should throw an error if attempt to register with the same username", async () => {
    const response = await request(app).post("/register").send({
      username: "Mary",
      password: "password123",
      firstName: "Mary",
      lastName: "Campbell",
    });

    expect(response.statusCode).toBe(400); // Expect 400 for bad request
    expect(response.body.message).toBe("Username already exists"); // Correct error message
  });

  // Test case for accessing a protected route without a token (should return 401)
  it("should return 401 on protected route without token", async () => {
    const response = await request(app).get("/protected");
    expect(response.statusCode).toBe(401); // Expect 401 if no token is provided
  });

  // Test case for successful login and setting of cookies (accessToken and refreshToken)
  it("should login successfully and set cookies", async () => {
    const response = await request(app)
      .post("/login")
      .send({ username: "Mary", password: "password123" });

    expect(response.statusCode).toBe(200); // Expect 200 OK for successful login
    expect(response.body.user).toHaveProperty("username", "Mary"); // Verify user data
    expect(response.headers["set-cookie"]).toBeDefined(); // Ensure cookies are set
    expect(response.headers["set-cookie"][0]).toMatch(/accessToken/); // Check for accessToken
    expect(response.headers["set-cookie"][1]).toMatch(/refreshToken/); // Check for refreshToken
  });

  // Test case for getting the current user data when a valid token is provided
  it("should return current user data when token is valid", async () => {
    const token = jwt.sign(
      {
        id: 1,
        username: "Mary",
        role: "patient",
        firstName: "Mary",
        lastName: "Campbell",
      },
      "supersecret"
    );

    const response = await request(app)
      .get("/me")
      .set("Cookie", [`accessToken=${token}`]);

    expect(response.statusCode).toBe(200); // Expect 200 OK if the token is valid
    expect(response.body).toHaveProperty("username", "Mary"); // Ensure correct user data is returned
  });

  // Test case for refreshing the token using a valid refresh token
  it("should refresh token when refresh token is valid", async () => {
    const refreshToken = jwt.sign(
      { id: 1, username: "Mary" },
      "refreshsupersecret"
    );

    const response = await request(app)
      .post("/refresh")
      .set("Cookie", [`refreshToken=${refreshToken}`]);

    expect(response.statusCode).toBe(200); // Expect 200 OK if refresh is successful
    expect(response.body.message).toBe("Token refreshed"); // Correct message for token refresh
    expect(response.headers["set-cookie"]).toBeDefined(); // Ensure new tokens are set in cookies
  });

  // Test case for refreshing the token with an invalid refresh token
  it("should return 403 for invalid refresh token", async () => {
    const response = await request(app)
      .post("/refresh")
      .set("Cookie", ["refreshToken=invalidtoken"]);

    expect(response.statusCode).toBe(403); // Expect 403 Forbidden if the refresh token is invalid
    expect(response.body.message).toBe("Invalid refresh token"); // Correct error message for invalid token
  });

  // Test case for logging out and clearing cookies
  it("should clear cookies on logout", async () => {
    const response = await request(app).post("/logout");
    expect(response.statusCode).toBe(200); // Expect 200 OK for successful logout
    expect(response.body.message).toBe("Logged out successfully"); // Correct success message
    expect(response.headers["set-cookie"]).toBeDefined(); // Ensure cookies are cleared
  });
});
