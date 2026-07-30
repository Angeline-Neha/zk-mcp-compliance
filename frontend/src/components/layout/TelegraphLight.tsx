interface Props {
  connected: boolean;
}

export function TelegraphLight({ connected }: Props) {
  return (
    <div className="flex items-center gap-1.5" title={connected ? "Wire connected" : "Reconnecting…"}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: connected ? "#4A8C6A" : "#B08D57",
          boxShadow: connected
            ? "0 0 6px 2px rgba(74,140,106,0.5)"
            : "0 0 4px 1px rgba(176,141,87,0.3)",
          animation: connected ? "none" : "telegraph-blink 0.9s ease-in-out infinite",
        }}
      />
      <span
        className="font-mono-data"
        style={{ fontSize: 9, color: "rgba(176,141,87,0.5)", letterSpacing: "0.08em" }}
      >
        {connected ? "CONNECTED" : "RECONNECTING"}
      </span>
    </div>
  );
}
