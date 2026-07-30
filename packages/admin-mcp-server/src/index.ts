import { app } from "./mcpServer";

const PORT = process.env.PORT ?? 4005;

app.listen(PORT, () => {
  console.log(`admin-mcp-server listening on :${PORT}`);
});