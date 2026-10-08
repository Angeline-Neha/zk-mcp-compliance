import { useEffect, useState } from "react";
import { checkAllHealth, ServiceHealth } from "../../lib/api";

/** Polls every service's /health endpoint. `null` until the first result arrives. */
export function useServiceHealth(intervalMs = 6000): ServiceHealth[] | null {
  const [health, setHealth] = useState<ServiceHealth[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      checkAllHealth()
        .then((h) => !cancelled && setHealth(h))
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [intervalMs]);

  return health;
}

export function ServiceHealthStrip({ health }: { health: ServiceHealth[] | null }) {
  return (
    <div className="zk-card">
      <h3 className="zk-card-title">Service health</h3>
      <p className="zk-card-sub">Live /health check for each service, refreshed every 6 seconds.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {health === null && <span className="zk-pill"><i />Checking…</span>}
        {health?.map((s) => (
          <span key={s.name} className={`zk-pill ${s.up ? "zk-pill--up" : "zk-pill--down"}`} title={s.url}>
            <i />
            {s.name}
            <span style={{ opacity: 0.6 }}>{s.up ? "up" : "down"}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
