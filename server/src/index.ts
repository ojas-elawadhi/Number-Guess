import "dotenv/config";

import cors from "cors";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { getDatabaseHealth, getHealth } from "./controllers/health.controller";
import { progressionRouter } from "./controllers/progression.controller";
import { registerGameSocketHandlers } from "./sockets/game.socket";
import type { ClientToServerEvents, ServerToClientEvents } from "./types/game.types";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const configuredOrigins = (process.env.CLIENT_ORIGIN ?? "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAnyOrigin = configuredOrigins.includes("*");

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: allowAnyOrigin ? true : configuredOrigins,
    credentials: true
  })
);

app.get("/", (_request, response) => {
  response.json({
    status: "ok",
    service: "higher-lower-server"
  });
});

app.get("/health", getHealth);
app.get("/health/db", getDatabaseHealth);
app.use("/api/progression", progressionRouter);

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: allowAnyOrigin ? true : configuredOrigins,
    credentials: true
  }
});

registerGameSocketHandlers(io);

httpServer.listen(PORT, HOST, () => {
  console.log(`Higher or Lower server listening on ${HOST}:${PORT}`);
});
