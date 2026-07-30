import express, { Router } from "express";

const FINANCE_URL = process.env.FINANCE_URL ?? "http://localhost:4003";
const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:4005";

export const demoControlRouter: Router = express.Router();
demoControlRouter.post("/reset-all", async (_req, res) => {
  const [financeRes, adminRes] = await Promise.all([
    fetch(`${FINANCE_URL}/demo/reset`, { method: "POST" }),
    fetch(`${ADMIN_URL}/demo/reset`, { method: "POST" }),
  ]);
  res.status(200).json({ finance: await financeRes.json(), admin: await adminRes.json() });
});