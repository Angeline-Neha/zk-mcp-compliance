const INK = "#0A3323";
const PASS = "#53662D";
const FAIL = "#A8362C";
const BRASS = "#5E2750";
const PENDING = "rgba(10,51,35,0.5)";

import type { CSSProperties } from "react";

export function monoStyle(size = 9): CSSProperties {
  return {
    fontFamily: "var(--zk-mono)",
    fontSize: size,
    color: INK,
    lineHeight: 1.6,
  };
}

export function stampStyle(): CSSProperties {
  return {
    fontFamily: "var(--zk-sans)",
    fontSize: 13,
    fontWeight: 700,
    color: INK,
  };
}

export function statusColor(status: "pending" | "pass" | "fail"): string {
  if (status === "pass") return PASS;
  if (status === "fail") return FAIL;
  return PENDING;
}

export function truncateHex(hex: string, head = 8, tail = 6): string {
  if (hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export { INK, PASS, FAIL, BRASS };
