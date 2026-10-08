interface Props {
  connected: boolean;
}

export function TelegraphLight({ connected }: Props) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 7 }}
      title={connected ? "Live stream connected" : "Reconnecting…"}
    >
      <span className={`zk-live-dot${connected ? "" : " zk-live-dot--off"}`} />
      <span style={{ fontSize: 12, color: "#F7F4D5" }}>
        {connected ? "Live stream connected" : "Reconnecting…"}
      </span>
    </div>
  );
}
