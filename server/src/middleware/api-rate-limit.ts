import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const getRequestPlayerKey = (request: Request) => {
  const body = request.body as { playerKey?: unknown } | undefined;
  const query = request.query as { playerKey?: unknown };
  const playerKey = body?.playerKey ?? query.playerKey;

  return typeof playerKey === "string" && playerKey.trim().length > 0 ? playerKey.trim() : "anonymous";
};

export const apiRateLimit = (request: Request, response: Response, next: NextFunction) => {
  const now = Date.now();
  const playerKey = getRequestPlayerKey(request);
  const key = `${request.ip}:${playerKey}`;
  const existingBucket = buckets.get(key);
  const bucket = existingBucket && existingBucket.resetAt > now
    ? existingBucket
    : {
        count: 0,
        resetAt: now + WINDOW_MS
      };

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    response.status(429).json({
      message: "Too many requests. Please wait a moment and try again."
    });
    return;
  }

  if (buckets.size > 1_000) {
    for (const [bucketKey, currentBucket] of buckets) {
      if (currentBucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
  }

  next();
};
