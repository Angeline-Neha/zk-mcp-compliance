import express, { Application } from "express";
import { taskRouter, adminTaskRouter } from "./routes/task";
import { attacksRouter } from "./routes/attacks";
import { demoControlRouter } from "./routes/demoControl";
import { registerSSE } from "./sse";

export const app: Application = express();
app.use(express.json());
app.use(require("cors")());
app.use("/task", taskRouter);
app.use("/admin-task", adminTaskRouter);
app.use("/attack", attacksRouter);
app.use("/demo", demoControlRouter);
registerSSE(app);

app.get("/health", (_req, res) => res.json({ ok: true }));