const INK = "#1F1B16";
const PASS = "#2F4A3B";
const FAIL = "#B23A2F";
const BRASS = "#B08D57";
const PENDING = "rgba(31,27,22,0.35)";

import type { CSSProperties } from "react";

export function monoStyle(size = 9): CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
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
