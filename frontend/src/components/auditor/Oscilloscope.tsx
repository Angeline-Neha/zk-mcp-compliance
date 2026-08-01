import { useEffect, useState } from "react";

export function Oscilloscope() {
  const [points, setPoints] = useState<number[]>(Array(50).fill(50));

  useEffect(() => {
    const interval = setInterval(() => {
      setPoints((prev) => {
        const next = [...prev.slice(1)];
        const rand = Math.random();
        if (rand > 0.9) {
          next.push(Math.random() * 40 + 60); // Spike
        } else if (rand > 0.95) {
          next.push(Math.random() * 20);       // Dip
        } else {
          next.push(50 + (Math.random() * 10 - 5)); // Noise
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const pathD = points
    .map((p, i) => {
      const x = i * 4;
      const y = 100 - p;
      return (i === 0 ? "M" : "L") + " " + x + " " + y;
    })
    .join(" ");

  return (
    <div className="flex flex-col items-end">
      <div className="font-mono-data text-[10px] uppercase text-[#1F1B16] opacity-60 mb-1">
        Session Heartbeat
      </div>
      <div className="w-[200px] h-[30px] bg-[rgba(31,27,22,0.03)] border border-[rgba(31,27,22,0.1)] rounded-sm overflow-hidden flex items-center">
        <svg width="200" height="30" viewBox="0 0 200 100" preserveAspectRatio="none">
          <path
            d={pathD}
            fill="none"
            stroke="#B08D57"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}
