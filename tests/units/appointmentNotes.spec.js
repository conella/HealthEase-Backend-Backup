import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
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

describe("Appointment Notes API", () => {
  const appointmentId = 5;
  const notes = "Follow-up in 2 weeks";

  it("should update notes for a valid appointment", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .put(`/api/updatenotes/addnotes/${appointmentId}`)
      .send({ notes });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: "Notes updated successfully" });
    expect(mockQuery).toHaveBeenCalledWith(
      `UPDATE appointments SET notes = $1 WHERE id = $2`,
      [notes, appointmentId]
    );
  });

  it("should return 404 if appointment is not found", async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });

    const res = await request(app)
      .put(`/api/updatenotes/addnotes/9999`)
      .send({ notes: "Test" });

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Appointment not found" });
  });

  it("should return 400 if notes or appointmentId are missing", async () => {
    const res = await request(app).put(`/api/updatenotes/addnotes/`).send({});

    expect(res.statusCode).toBe(404); // Invalid route without appointmentId
  });

  it("should return 500 if there is a DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .put(`/api/updatenotes/addnotes/${appointmentId}`)
      .send({ notes });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Failed to update notes" });
  });
});
