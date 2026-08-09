const INK = "#E9E4F2";
const PASS = "#54C99A";
const FAIL = "#E15068";
const BRASS = "#D9A94A";
const PENDING = "rgba(233,228,242,0.35)";

import type { CSSProperties } from "react";

export function monoStyle(size = 9): CSSProperties {
  return {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: size,
    color: INK,
    lineHeight: 1.6,
  };
}

export function stampStyle(): CSSProperties {
  return {
    fontFamily: "'Special Elite', serif",
    fontSize: 10,
    letterSpacing: "0.15em",
    textTransform: "uppercase" as const,
    color: BRASS,
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
