import "dotenv/config";

import cors from "cors";
import express from "express";
import { createServer } from "http";
import path from "path";
import { Server } from "socket.io";

import { dailyPuzzleRouter } from "./controllers/daily-puzzle.controller";
import { getDatabaseHealth, getHealth } from "./controllers/health.controller";
import { progressionRouter } from "./controllers/progression.controller";
import {
  getAvatarDownloadUrl,
  getAvatarObjectKey,
  isAvatarStorageConfigured
} from "./services/avatar-storage.service";
import { registerGameSocketHandlers } from "./sockets/game.socket";
import type { ClientToServerEvents, ServerToClientEvents } from "./types/game.types";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const configuredOrigins = (process.env.CLIENT_ORIGIN ?? "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAnyOrigin = configuredOrigins.includes("*");
const avatarDirectory = path.resolve(process.cwd(), "public", "avatars");

const app = express();
app.use(
  cors({
    origin: allowAnyOrigin ? true : configuredOrigins,
    credentials: true
  })
);
app.get("/avatars/:version/:filename", async (request, response, next) => {
  if (!isAvatarStorageConfigured) {
    next();
    return;
  }

  const objectKey = getAvatarObjectKey(request.params.version, request.params.filename);

  if (!objectKey) {
    response.status(404).json({ error: "Avatar not found." });
    return;
  }

  try {
    const downloadUrl = await getAvatarDownloadUrl(objectKey);
    response.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    response.redirect(302, downloadUrl);
  } catch (error) {
    next(error);
  }
});
app.use(
  "/avatars",
  express.static(avatarDirectory, {
    etag: true,
    immutable: true,
    maxAge: "1y",
    setHeaders: (response) => {
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      response.setHeader("X-Content-Type-Options", "nosniff");
    }
  })
);
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({
    status: "ok",
    service: "higher-lower-server"
  });
});

app.get("/health", getHealth);
app.get("/health/db", getDatabaseHealth);
app.use("/api/progression", progressionRouter);
app.use("/api/daily-puzzle", dailyPuzzleRouter);

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
