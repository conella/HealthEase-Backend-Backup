import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";

// Mock the pg module
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

describe("Doctor Availability API", () => {
  const doctorId = "1";
  const availabilityId = "10";

  // 1. Get availability
  it("should return availability for a doctor", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, dayofweek: "Monday", starttime: "09:00", endtime: "12:00" },
        { id: 2, dayofweek: "Wednesday", starttime: "14:00", endtime: "17:00" },
      ],
    });

    const res = await request(app).get(`/api/availability/availability/${doctorId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockQuery).toHaveBeenCalledWith(
      `SELECT id, dayofweek, starttime, endtime FROM doctoravailability WHERE doctorid = $1 ORDER BY dayofweek`,
      [doctorId]
    );
  });

  // 2. Add availability
  it("should add a new availability entry", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: availabilityId,
          doctorid: doctorId,
          dayofweek: "Friday",
          starttime: "10:00",
          endtime: "13:00",
        },
      ],
    });

    const res = await request(app).post("/api/availability/availability").send({
      doctorId,
      day: "Friday",
      startTime: "10:00",
      endTime: "13:00",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("dayofweek", "Friday");
    expect(mockQuery).toHaveBeenCalledWith(
      `INSERT INTO doctoravailability (doctorid, dayofweek, starttime, endtime)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [doctorId, "Friday", "10:00", "13:00"]
    );
  });

  // 3. Update availability
  it("should update an existing availability", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: availabilityId,
          doctorid: doctorId,
          dayofweek: "Tuesday",
          starttime: "08:00",
          endtime: "11:00",
        },
      ],
    });

    const res = await request(app).put(`/api/availability/availability/${availabilityId}`).send({
      day: "Tuesday",
      startTime: "08:00",
      endTime: "11:00",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("dayofweek", "Tuesday");
    expect(mockQuery).toHaveBeenCalledWith(
      `UPDATE doctoravailability 
       SET dayofweek = $1, starttime = $2, endtime = $3
       WHERE id = $4
       RETURNING *`,
      ["Tuesday", "08:00", "11:00", availabilityId]
    );
  });

  it("should return 404 when updating non-existent availability", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).put(`/api/availability/availability/9999`).send({
      day: "Thursday",
      startTime: "08:00",
      endTime: "10:00",
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Availability not found" });
  });

  // 4. Delete availability
  it("should delete an availability entry", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: availabilityId }],
    });

    const res = await request(app).delete(`/api/availability/availability/${availabilityId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: "Doctor availability deleted successfully" });
    expect(mockQuery).toHaveBeenCalledWith(
      `DELETE FROM doctoravailability WHERE id = $1 RETURNING *`,
      [availabilityId]
    );
  });

  it("should return 404 if availability entry not found for deletion", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).delete(`/api/availability/availability/9999`);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Availability not found" });
  });

  it("should return 500 if database error occurs", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).get(`/api/availability/availability/${doctorId}`);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Failed to fetch doctor availability" });
  });
});