import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";

const TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60;
const TOKEN_SECRET =
  process.env.SESSION_TOKEN_SECRET ??
  process.env.DATABASE_URL ??
  "higher-lower-development-session-token";

interface SessionTokenPayload {
  exp: number;
  playerKey: string;
}

const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string) =>
  createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");

export const issueSessionToken = (playerKey: string) => {
  const payload: SessionTokenPayload = {
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    playerKey
  };
  const encodedPayload = encode(JSON.stringify(payload));

  return `${encodedPayload}.${sign(encodedPayload)}`;
};

const readBearerToken = (request: Request) => {
  const authorizationHeader = request.get("authorization");

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
};

const safeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const verifySessionToken = (token: string, playerKey: string) => {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !safeEquals(signature, sign(encodedPayload))) {
    return false;
  }

  try {
    const payload = JSON.parse(decode(encodedPayload)) as Partial<SessionTokenPayload>;
    const nowSeconds = Math.floor(Date.now() / 1000);

    return payload.playerKey === playerKey && typeof payload.exp === "number" && payload.exp > nowSeconds;
  } catch {
    return false;
  }
};

export const authorizePlayerRequest = (request: Request, response: Response, playerKey?: string | null) => {
  if (!playerKey) {
    response.status(400).json({
      message: "playerKey is required."
    });
    return false;
  }

  const token = readBearerToken(request);

  if (!token || !verifySessionToken(token, playerKey)) {
    response.status(401).json({
      message: "Your session expired. Reopen the game and try again."
    });
    return false;
  }

  return true;
};

export const withSessionToken = <T extends { playerKey: string }>(payload: T) => ({
  ...payload,
  sessionToken: issueSessionToken(payload.playerKey)
});
