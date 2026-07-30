import express, { Express, Request, Response } from "express";
import { z } from "zod";
// snarkjs ships without types; groth16.fullProve / groth16.verify are the
// real proving/verification functions, same ones the CLI wraps.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snarkjs = require("snarkjs");
import fs from "fs";
import { getCircuit } from "./circuitRegistry.js";
import path from "path";

// ✅ FIX #1: Add explicit type annotation for app
export const app: Express = express();
app.use(express.json({ limit: "1mb" }));
app.use(require("cors")());
// ✅ FIX #3 & #4: Fix input schema to accept only strings (circuit inputs are always strings)
const proveSchema = z.object({
  circuitId: z.string().min(1),
  input: z.record(z.string(), z.string()),  // ← Changed to z.string() only
  accountRef: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /prove — generate a real Groth16 proof from real private inputs.
// This is called by an agent (or a compliance micro-service holding the
// real transaction data) per Stage 5 of the spec. The private inputs never
// leave this call — only {proof, publicSignals} go back to the caller.
// ---------------------------------------------------------------------------
app.post("/prove", async (req: Request, res: Response) => {
  const parsed = proveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  const { circuitId, input, accountRef } = parsed.data;

  // ✅ Get circuit first (before validation)
  let circuit;
  try {
    circuit = getCircuit(circuitId);
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }

  // ✅ VALIDATE: Private inputs match real DB state
  if (circuitId === "deletionPolicy" && accountRef) {
    try {
      // ✅ FIX #2: Add .js extension for node16 module resolution
      const { getAccount } = await import("./db.js");
      
      const realAccount = await getAccount(accountRef);
      if (!realAccount) {
        return res.status(404).json({ 
          error: "account not found",
          accountRef
        });
      }

      // ✅ FIX #3 & #4: Input is always string from schema now, just compare strings
      const consentGiven = input.consentGiven;
      const realConsent = realAccount.consentGiven ? "1" : "0";
      
      const daysSinceLastTx = input.daysSinceLastTransaction;
      const realDaysSince = String(realAccount.daysSinceLastTransaction);
      
      const hasActiveDep = input.hasActiveDependency;
      const realHasActiveDep = realAccount.hasActiveDependency ? "1" : "0";

      // ✅ REJECT if inputs don't match
      if (
        consentGiven !== realConsent ||
        daysSinceLastTx !== realDaysSince ||
        hasActiveDep !== realHasActiveDep
      ) {
        return res.status(422).json({
          error: "proof inputs do not match account state",
          claimed: {
            consentGiven: input.consentGiven,
            daysSinceLastTransaction: input.daysSinceLastTransaction,
            hasActiveDependency: input.hasActiveDependency,
          },
          actual: {
            consentGiven: realConsent,
            daysSinceLastTransaction: realDaysSince,
            hasActiveDependency: realHasActiveDep,
          },
        });
      }
    } catch (err: any) {
      // If it's not our validation error, it's a DB error
      if (!err.message?.includes("do not match")) {
        return res.status(500).json({ 
          error: "failed to validate inputs against account",
          detail: err.message 
        });
      }
      throw err;
    }
  }

  // ✅ NOW generate proof (only after validation passes)
  try {
    const start = Date.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      circuit.wasm,
      circuit.zkey
    );
    const durationMs = Date.now() - start;
    res.status(200).json({ proof, publicSignals, durationMs });
  } catch (err: any) {
    // A circuit constraint failure (e.g. the policy-commitment check from
    // Attack #7) surfaces here as a witness-generation error. This is a
    // GENUINE cryptographic rejection, not an application-level if-check —
    // the witness literally cannot be computed for these inputs.
    res.status(422).json({
      error: "proof generation failed — inputs do not satisfy circuit constraints",
      detail: String(err.message ?? err),
    });
  }
});

// ---------------------------------------------------------------------------
// POST /verify — verify a Groth16 proof against the known verification key.
// <10ms per the spec's cited Groth16 characteristic (verification is always
// cheap regardless of circuit complexity) — this is what the finance-mcp-
// server's gate will call for every tool invocation's Proof 2.
// ---------------------------------------------------------------------------
const verifySchema = z.object({
  circuitId: z.string().min(1),
  proof: z.record(z.string(), z.any()),
  publicSignals: z.array(z.string()),
});

app.post("/verify", async (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid request", details: parsed.error.issues });
  }
  const { circuitId, proof, publicSignals } = parsed.data;

  let circuit;
  try {
    circuit = getCircuit(circuitId);
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }

  const vKey = JSON.parse(fs.readFileSync(circuit.verificationKey, "utf-8"));

  const start = Date.now();
  const valid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
  const durationMs = Date.now() - start;

  res.status(200).json({ valid, durationMs });
});

app.get("/health", (_req, res) => res.json({ ok: true, circuits: Object.keys(require("./circuitRegistry").CIRCUITS) }));
