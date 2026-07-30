import { useEffect, useState } from "react";
import { checkAllHealth, type ServiceHealth } from "../lib/api";

export function StatusBar() {
  const [services, setServices] = useState<ServiceHealth[]>([]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const results = await checkAllHealth();
      if (mounted) setServices(results);
    };
    check();
    const interval = setInterval(check, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="border-b border-slate-line bg-ink-raised px-4 py-2 flex items-center gap-6 overflow-x-auto scrollbar-thin">
      <span className="font-display font-semibold text-sm tracking-tight whitespace-nowrap">
        ZK-MCP <span className="text-data">Verification Console</span>
      </span>
      <div className="flex items-center gap-4 ml-auto">
        {services.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                s.up ? "bg-pass shadow-[0_0_6px_theme(colors.pass.DEFAULT)]" : "bg-fail"
              }`}
            />
            <span className="text-xs font-mono-data text-slate-400">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}