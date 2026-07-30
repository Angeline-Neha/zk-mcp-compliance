import { app } from "./mcpServer";

const PORT = process.env.PORT ?? 4003;

app.listen(PORT, () => {
  console.log(`finance-mcp-server listening on :${PORT}`);
});
