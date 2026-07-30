import path from "path";

export interface CircuitFiles {
  wasm: string;
  zkey: string;
  verificationKey: string;
}

const CIRCUITS_DIR = path.join(__dirname, "..", "circuits");

/**
 * Registry of known circuits. Adding a new tool's compliance circuit means
 * running its own trusted setup (per the roadmap: "if the policy thresholds
 * change, the circuit changes, and setup must be re-run") and registering
 * the resulting artifacts here.
 */
export const CIRCUITS: Record<string, CircuitFiles> = {
  refundPolicy: {
    wasm: path.join(CIRCUITS_DIR, "refundPolicy", "refundPolicy.wasm"),
    zkey: path.join(CIRCUITS_DIR, "refundPolicy", "refundPolicy_final.zkey"),
    verificationKey: path.join(
      CIRCUITS_DIR,
      "refundPolicy",
      "refundPolicy_verification_key.json"
    ),
  },
  deletionPolicy: {
    wasm: path.join(CIRCUITS_DIR, "deletionPolicy", "deletionPolicy.wasm"),
    zkey: path.join(CIRCUITS_DIR, "deletionPolicy", "deletionPolicy_final.zkey"),
    verificationKey: path.join(
      CIRCUITS_DIR,
      "deletionPolicy",
      "deletionPolicy_verification_key.json"
    ),
  },
};

export function getCircuit(circuitId: string): CircuitFiles {
  const circuit = CIRCUITS[circuitId];
  if (!circuit) {
    throw new Error(`Unknown circuit: ${circuitId}`);
  }
  return circuit;
}
