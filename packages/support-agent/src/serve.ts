import { app } from "./mcpServer";

const PORT = process.env.PORT ?? 4004;

app.listen(PORT, () => {
  console.log(`support-agent MCP server listening on :${PORT}`);
});