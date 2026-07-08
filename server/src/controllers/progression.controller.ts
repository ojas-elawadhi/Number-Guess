import { Router } from "express";

import { authorizePlayerRequest, withSessionToken } from "../middleware/session-token";
import { progressionService } from "../services/progression.service";
import type {
  ClaimDailyRewardPayload,
  ProgressBootstrapPayload,
  ProgressPreferencesPayload,
  RecordMatchPayload,
  UpdateDisplayNamePayload
} from "../../../shared/progression.types";

export const progressionRouter = Router();

const hasSupportedPreferenceUpdate = (payload: ProgressPreferencesPayload) =>
  payload.tutorialSeen === true ||
  typeof payload.soundPlaceholdersEnabled === "boolean" ||
  typeof payload.avatarId === "string" ||
  typeof payload.premiumAvatarId === "string" ||
  Boolean(payload.singlePlayerHighRounds && Object.keys(payload.singlePlayerHighRounds).length > 0) ||
  Boolean(payload.singlePlayerHighScores && Object.keys(payload.singlePlayerHighScores).length > 0) ||
  (typeof payload.extraGuessPowerUpsDelta === "number" && payload.extraGuessPowerUpsDelta !== 0) ||
  (typeof payload.skipBoostersDelta === "number" && payload.skipBoostersDelta !== 0) ||
  (typeof payload.coinsDelta === "number" && payload.coinsDelta !== 0) ||
  Boolean(payload.activePracticeRun);

progressionRouter.post("/bootstrap", async (request, response) => {
  try {
    const payload = request.body as ProgressBootstrapPayload;
    const result = await progressionService.bootstrap(payload);
    response.json(withSessionToken(result));
  } catch (error) {
    console.error("[progression/bootstrap]", error);
    response.status(503).json({
      message: error instanceof Error ? error.message : "Could not initialize player progression."
    });
  }
});

progressionRouter.patch("/preferences", async (request, response) => {
  try {
    const payload = request.body as ProgressPreferencesPayload;

    if (!authorizePlayerRequest(request, response, payload.playerKey)) {
      return;
    }

    if (hasSupportedPreferenceUpdate(payload)) {
      response.json(withSessionToken(await progressionService.updatePreferences(payload)));
      return;
    }

    response.status(400).json({
      message: "No supported preference update was provided."
    });
  } catch (error) {
    console.error("[progression/preferences]", error);
    response.status(503).json({
      message: error instanceof Error ? error.message : "Could not update progression preferences."
    });
  }
});

progressionRouter.post("/tutorial-event", (request, response) => {
  const { playerKey, event } = request.body as { playerKey?: string; event?: string };
  console.log(`[tutorial-event] ${new Date().toISOString()} player=${playerKey ?? "unknown"} event=${event ?? "unknown"}`);
  response.json({ ok: true });
});

progressionRouter.patch("/display-name", async (request, response) => {
  try {
    const payload = request.body as UpdateDisplayNamePayload;
    if (!authorizePlayerRequest(request, response, payload.playerKey)) {
      return;
    }

    response.json(withSessionToken(await progressionService.updateDisplayName(payload.playerKey, payload.displayName)));
  } catch (error) {
    console.error("[progression/display-name]", error);
    response.status(503).json({
      message: error instanceof Error ? error.message : "Could not update the username."
    });
  }
});

progressionRouter.post("/daily-reward", async (request, response) => {
  try {
    const payload = request.body as ClaimDailyRewardPayload;
    if (!authorizePlayerRequest(request, response, payload.playerKey)) {
      return;
    }

    response.json(withSessionToken(await progressionService.claimDailyReward(payload.playerKey)));
  } catch (error) {
    console.error("[progression/daily-reward]", error);
    response.status(503).json({
      message: error instanceof Error ? error.message : "Could not claim the daily reward."
    });
  }
});

progressionRouter.post("/match", async (request, response) => {
  try {
    const payload = request.body as RecordMatchPayload;
    if (!authorizePlayerRequest(request, response, payload.playerKey)) {
      return;
    }

    response.json(withSessionToken(await progressionService.recordMatch(payload.playerKey, payload.input)));
  } catch (error) {
    console.error("[progression/match]", error);
    response.status(503).json({
      message: error instanceof Error ? error.message : "Could not record the match."
    });
  }
});
