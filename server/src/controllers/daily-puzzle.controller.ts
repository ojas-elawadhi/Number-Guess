import { Router } from "express";

import { authorizePlayerRequest, withSessionToken } from "../middleware/session-token";
import { dailyPuzzleService } from "../services/daily-puzzle.service";
import type {
  DailyPuzzleGuessPayload,
  DailyPuzzleLeaderboardPayload,
  DailyPuzzleStatusPayload
} from "../../../shared/progression.types";

export const dailyPuzzleRouter = Router();

dailyPuzzleRouter.get("/status", async (request, response) => {
  try {
    const payload = request.query as unknown as DailyPuzzleStatusPayload;

    if (!payload.playerKey) {
      response.status(400).json({
        message: "playerKey is required."
      });
      return;
    }

    response.json(await dailyPuzzleService.getStatus(payload.playerKey, payload.dateKey));
  } catch (error) {
    console.error("[daily-puzzle/status]", error);
    response.status(503).json({
      message: error instanceof Error ? error.message : "Could not load the daily puzzle."
    });
  }
});

dailyPuzzleRouter.get("/leaderboard", async (request, response) => {
  try {
    const payload = request.query as unknown as DailyPuzzleLeaderboardPayload;

    if (!payload.playerKey) {
      response.status(400).json({
        message: "playerKey is required."
      });
      return;
    }

    response.json(await dailyPuzzleService.getDailyLeaderboard(payload.playerKey, payload.dateKey));
  } catch (error) {
    console.error("[daily-puzzle/leaderboard]", error);
    const statusCode =
      error instanceof Error && error.message.includes("today and yesterday only") ? 400 : 503;

    response.status(statusCode).json({
      message: error instanceof Error ? error.message : "Could not load the daily puzzle leaderboard."
    });
  }
});

dailyPuzzleRouter.post("/guess", async (request, response) => {
  try {
    const payload = request.body as DailyPuzzleGuessPayload;

    if (!payload.playerKey || !payload.dateKey) {
      response.status(400).json({
        message: "playerKey and dateKey are required."
      });
      return;
    }

    if (!authorizePlayerRequest(request, response, payload.playerKey)) {
      return;
    }

    response.json(withSessionToken(await dailyPuzzleService.submitGuess(payload)));
  } catch (error) {
    console.error("[daily-puzzle/guess]", error);
    response.status(503).json({
      message: error instanceof Error ? error.message : "Could not submit the daily puzzle guess."
    });
  }
});
