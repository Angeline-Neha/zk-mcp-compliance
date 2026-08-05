import { app } from "./app";

const PORT = process.env.PORT ?? 4008;

app.listen(PORT, () => {
  console.log(`baseline-agent (traditional, non-ZK) listening on :${PORT}`);
});
