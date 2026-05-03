import type { Request, Response } from "express";

import { prisma } from "../lib/prisma";

export const getHealth = (_request: Request, response: Response) => {
  response.json({
    status: "ok",
    service: "higher-lower-server",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    timestamp: new Date().toISOString()
  });
};

export const getDatabaseHealth = async (_request: Request, response: Response) => {
  if (!process.env.DATABASE_URL) {
    response.status(503).json({
      status: "error",
      databaseConfigured: false,
      message: "DATABASE_URL is missing on the server."
    });
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    const playerCount = await prisma.playerProgress.count();

    response.json({
      status: "ok",
      databaseConfigured: true,
      playerCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    response.status(503).json({
      status: "error",
      databaseConfigured: true,
      message: error instanceof Error ? error.message : "Database connection failed."
    });
  }
};
