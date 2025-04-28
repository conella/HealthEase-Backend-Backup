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
  ({ app, server } = await import("../../server")); // Dynamically import server after mock
});

afterAll(() => {
  server.close(); // Close the server after all tests
});

beforeEach(() => {
  vi.clearAllMocks(); // Reset mocks between tests
});

// Grouping all doctor-related tests
describe("Doctors API", () => {
  afterAll(() => {
    server.close(); // Close the server after all tests
  });

  beforeEach(() => {
    // Reset all mocks before each test to ensure clean state
    vi.clearAllMocks();
  });

  // Test case for GET /api/doctors (without departmentId filter)
  it("should return a list of doctors without departmentId filter", async () => {
    // Mock the behavior for a successful query to fetch departments
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          doctorid: 2,
          firstname: "John",
          lastname: "Turner",
          email: "johndoc@hopewellgeneral.com",
          departmentid: 3,
        },
        {
          doctorid: 3,
          firstname: "Lucas",
          lastname: "Clarke",
          email: "lclarke@hopewellgeneral.com",
          departmentid: 12,
        },
      ],
    });
    const response = await request(app).get("/api/doctors");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toHaveProperty("id", 2);
    expect(response.body[0]).toHaveProperty("firstname", "John");
    expect(response.body[0]).toHaveProperty("lastname", "Turner");
    expect(response.body[0]).toHaveProperty(
      "email",
      "johndoc@hopewellgeneral.com"
    );
    expect(response.body[0]).toHaveProperty("departmentId", 3);
  });

  // Test case for GET /api/doctors/find-doctors (getting full details of all doctors)
  it("should return a list of doctors with their full details", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          doctorname: "John Turner", // Ensure this matches the concatenated result
          email: "johndoc@hopewellgeneral.com",
          phonenumber: "123456789",
          department: "Neurology", // Mock department name
        },
        {
          doctorname: "Lucas Clarke",
          email: "lclarke@hopewellgeneral.com",
          phonenumber: "456789456",
          department: "Gastroenterology",
        },
      ],
    });
    const response = await request(app).get("/api/doctors/find-doctors");

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toHaveProperty("doctorname", "John Turner");
    expect(response.body[0]).toHaveProperty(
      "email",
      "johndoc@hopewellgeneral.com"
    );
    expect(response.body[0]).toHaveProperty("phonenumber");
    expect(response.body[0]).toHaveProperty("department");
  });

  it("should return a 500 error if the database query fails", async () => {
    // Mock the behavior for a failed query (simulating an error)
    mockQuery.mockRejectedValueOnce(new Error("Database query failed"));

    const response = await request(app).get("/api/doctors");

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: "Failed to fetch doctors" });
  });
});
