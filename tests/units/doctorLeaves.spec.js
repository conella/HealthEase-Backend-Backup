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

describe("Doctor Leaves API", () => {
  const doctorId = "1";

  it("should return leave dates for a doctor", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ leavedate: "2025-05-10" }, { leavedate: "2025-05-15" }],
    });

    const res = await request(app).get(
      `/api/showleavedays/getleaves/${doctorId}`
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([
      { leavedate: "2025-05-10" },
      { leavedate: "2025-05-15" },
    ]);
    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT leavedate FROM doctorleaves WHERE doctorid = $1",
      [doctorId]
    );
  });

  it("should return 500 if a database error occurs", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).get(
      `/api/showleavedays/getleaves/${doctorId}`
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Failed to fetch leaves" });
  });
});
