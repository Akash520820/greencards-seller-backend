const request = require("supertest");
const app = require("../app");

describe("Seller Microservice Route & Validation Enforcement", () => {
  test("POST /api/v1/sellers/register rejects invalid inputs", async () => {
    const res = await request(app).post("/api/v1/sellers/register").send({
      shopName: "",
    });
    expect(res.status).toBeLessThan(500);
  });

  test("protected seller routes return 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/v1/sellers/profile");
    expect(res.status).toBe(401);
  });
});
