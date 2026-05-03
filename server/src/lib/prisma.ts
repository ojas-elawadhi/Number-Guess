import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __higherLowerPrisma__: PrismaClient | undefined;
}

const prismaClient =
  global.__higherLowerPrisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.__higherLowerPrisma__ = prismaClient;
}

export const prisma = prismaClient;
