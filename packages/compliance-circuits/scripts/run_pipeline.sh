#!/usr/bin/env bash
# Phase 3 — raw pipeline script, run BEFORE wrapping anything in a service.
# compile -> Powers of Tau (2^12) -> phase-2 setup -> proving/verification
# keys -> generate a proof from real inputs -> verify it.
set -euo pipefail

cd "$(dirname "$0")/.."
BUILD=build
CIRCUIT=refundPolicy

mkdir -p "$BUILD"

echo "==> 1. Compile circuit"
circom circuits/${CIRCUIT}.circom \
  --r1cs --wasm --sym \
  -l node_modules \
  -o "$BUILD"

echo "==> 2. Powers of Tau (2^12 — small, sufficient for this circuit's constraint count)"
npx snarkjs powersoftau new bn128 12 "$BUILD/pot12_0000.ptau" -v
npx snarkjs powersoftau contribute "$BUILD/pot12_0000.ptau" "$BUILD/pot12_0001.ptau" \
  --name="phase0 contribution" -e="$(head -c 32 /dev/urandom | base64)" -v
npx snarkjs powersoftau prepare phase2 "$BUILD/pot12_0001.ptau" "$BUILD/pot12_final.ptau" -v

echo "==> 3. Phase-2 setup (circuit-specific)"
npx snarkjs groth16 setup "$BUILD/${CIRCUIT}.r1cs" "$BUILD/pot12_final.ptau" "$BUILD/${CIRCUIT}_0000.zkey"
npx snarkjs zkey contribute "$BUILD/${CIRCUIT}_0000.zkey" "$BUILD/${CIRCUIT}_final.zkey" \
  --name="phase2 contribution" -e="$(head -c 32 /dev/urandom | base64)" -v
npx snarkjs zkey export verificationkey "$BUILD/${CIRCUIT}_final.zkey" "$BUILD/${CIRCUIT}_verification_key.json"

echo "==> 4. Generate a proof from real inputs (inputs/valid.json)"
node "$BUILD/${CIRCUIT}_js/generate_witness.js" \
  "$BUILD/${CIRCUIT}_js/${CIRCUIT}.wasm" \
  inputs/valid.json \
  "$BUILD/witness.wtns"

npx snarkjs groth16 prove "$BUILD/${CIRCUIT}_final.zkey" "$BUILD/witness.wtns" \
  "$BUILD/proof.json" "$BUILD/public.json"

echo "==> 5. Verify the proof"
npx snarkjs groth16 verify "$BUILD/${CIRCUIT}_verification_key.json" "$BUILD/public.json" "$BUILD/proof.json"

echo ""
echo "=================================================="
echo " Phase 3 raw pipeline complete."
echo " proof.json / public.json / verification key all in $BUILD/"
echo "=================================================="
