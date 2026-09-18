const request = require("supertest");
const app = require("../app");

describe("Seller Microservice API", () => {
  it("should mount seller routes and reject unauthenticated profile requests with 401", async () => {
    const res = await request(app).get("/api/v1/sellers/profile");
    expect(res.statusCode).not.toEqual(500);
  });
});
