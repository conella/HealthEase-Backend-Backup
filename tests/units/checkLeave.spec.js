import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";

// Mock the pg module before importing anything that uses it
const mockQuery = vi.fn();

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

let app, server;

beforeAll(async () => {
  ({ app, server } = await import("../../server"));
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/checkdoctorleaves/checkleave", () => {
  it("should return isOnLeave: true if the doctor is on leave", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ doctorId: 2, selectedDate: "2025-05-01" }],
    });

    const res = await request(app).post("/api/checkdoctorleaves/checkleave").send({
      doctorId: 2,
      selectedDate: "2025-05-01",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      isOnLeave: true,
      message: "Doctor is on leave on the selected date.",
    });

    expect(mockQuery).toHaveBeenCalledWith(
      `SELECT * FROM doctorleaves WHERE doctorid = $1 AND leavedate = $2`,
      [2, "2025-05-01"]
    );
  });

  it("should return isOnLeave: false if the doctor is not on leave", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post("/api/checkdoctorleaves/checkleave").send({
      doctorId: 3,
      selectedDate: "2025-06-01",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      isOnLeave: false,
      message: "Doctor is available on the selected date.",
    });
  });

  it("should return 400 if doctorId or selectedDate is missing", async () => {
    const res = await request(app).post("/api/checkdoctorleaves/checkleave").send({
      doctorId: null,
      selectedDate: null,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "Doctor ID and Selected Date are required",
    });
  });

  it("should return 500 if a database error occurs", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB failure"));

    const res = await request(app).post("/api/checkdoctorleaves/checkleave").send({
      doctorId: 2,
      selectedDate: "2025-07-01",
    });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: "Failed to check doctor's leave status",
    });
  });
});