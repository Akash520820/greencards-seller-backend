const express = require("express");
const request = require("supertest");
const validate = require("../shared/middleware/validate.middleware");
const errorHandler = require("../shared/middleware/errorHandler.middleware");

const { applyForSellerSchema } = require("../validators/seller.validators");

const appFor = (schema, part = "body") => {
  const app = express();
  app.use(express.json());
  app.post("/test", validate({ [part]: schema }), (req, res) => res.status(200).json({ ok: true }));
  app.use(errorHandler);
  return app;
};

describe("Seller validator schemas — seller application", () => {
  const app = appFor(applyForSellerSchema);
  const validBase = {
    businessName: "Akash Traders",
    gstNumber: "22AAAAA0000A1Z5",
    accountHolderName: "Akash",
    accountNumber: "123456789012",
    bankName: "State Bank",
    bankBranch: "Agartala",
  };

  test("rejects a malformed IFSC code", async () => {
    const res = await request(app).post("/test").send({ ...validBase, ifscCode: "NOTVALID" });
    expect(res.status).toBe(400);
  });
  test("accepts a valid IFSC code (case-insensitive, gets uppercased)", async () => {
    const res = await request(app).post("/test").send({ ...validBase, ifscCode: "sbin0001234" });
    expect(res.status).toBe(200);
  });
  test("rejects a non-numeric account number", async () => {
    const res = await request(app).post("/test").send({ ...validBase, ifscCode: "SBIN0001234", accountNumber: "abc" });
    expect(res.status).toBe(400);
  });
  test("rejects a missing GSTIN — now required, not optional", async () => {
    const { gstNumber, ...withoutGst } = validBase;
    const res = await request(app).post("/test").send({ ...withoutGst, ifscCode: "SBIN0001234" });
    expect(res.status).toBe(400);
  });
  test("rejects a malformed GSTIN", async () => {
    const res = await request(app)
      .post("/test")
      .send({ ...validBase, ifscCode: "SBIN0001234", gstNumber: "not-a-gstin" });
    expect(res.status).toBe(400);
  });
});
