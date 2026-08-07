import express, { Express } from "express";
import { taskRouter, adminTaskRouter } from "./routes/task";
import { attacksRouter } from "./routes/attacks";
import { redTeamRouter } from "./routes/redTeam";
import { demoControlRouter } from "./routes/demoControl";
import { registerEventsRoutes } from "./routes/events";
import { inspectorRouter } from "./routes/inspector";

export const app: Express = express();
app.use(express.json());
app.use(require("cors")());
app.use("/task", taskRouter);
app.use("/task/inspector", inspectorRouter);
app.use("/admin-task", adminTaskRouter);
app.use("/attack", attacksRouter);
app.use("/red-team", redTeamRouter);
app.use("/demo", demoControlRouter);
registerEventsRoutes(app);

app.get("/health", (_req, res) => res.json({ ok: true }));
