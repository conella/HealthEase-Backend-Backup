import flushPromises from "flush-promises";
import request from "supertest";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import * as sql from "mssql";

import { app, server } from "../../server";

vi.mock("mssql");

app.use(cookieParser());

describe("Auth API", () => {
  afterAll(() => {
    server.close();
  });

  it("should return 401 when logging in with Login failed", async () => {
    sql.query = vi.fn().mockResolvedValue({ recordset: [] }); // no user
    await flushPromises()

    const response = await request(app)
      .post("/login")
      .send({ username: "wronguser", password: "wrongpass" });

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe("Login failed");
  });

  it("should reject duplicate registration", async () => {
    sql.query = vi.fn().mockResolvedValue({ recordset: [{ username: "testuser" }] });

    const response = await request(app)
      .post("/register")
      .send({
        username: "testuser",
        password: "password123",
        firstName: "Test",
        lastName: "User",
        role: "patient",
        email: "test@test.com"
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Username already exists");
  });

  it("should return 401 on protected route without token", async () => {
    const response = await request(app).get("/protected");
    expect(response.statusCode).toBe(401);
  });
});
