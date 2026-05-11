import { Router } from "express";

import { progressionService } from "../services/progression.service";
import type {
  ClaimDailyRewardPayload,
  ProgressBootstrapPayload,
  ProgressPreferencesPayload,
  RecordMatchPayload,
  UpdateDisplayNamePayload
} from "../../../shared/progression.types";

export const progressionRouter = Router();

progressionRouter.post("/bootstrap", async (request, response) => {
  try {
    const payload = request.body as ProgressBootstrapPayload;
    const result = await progressionService.bootstrap(payload);
    response.json(result);
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

    if (payload.tutorialSeen === true) {
      response.json(await progressionService.markTutorialSeen(payload.playerKey));
      return;
    }

    if (typeof payload.soundPlaceholdersEnabled === "boolean") {
      response.json(
        await progressionService.setSoundPlaceholdersEnabled(payload.playerKey, payload.soundPlaceholdersEnabled)
      );
      return;
    }

    if (payload.singlePlayerHighRounds && Object.keys(payload.singlePlayerHighRounds).length > 0) {
      response.json(
        await progressionService.updateSinglePlayerHighRounds(payload.playerKey, payload.singlePlayerHighRounds)
      );
      return;
    }

    if (payload.singlePlayerHighScores && Object.keys(payload.singlePlayerHighScores).length > 0) {
      response.json(
        await progressionService.updateSinglePlayerHighScores(payload.playerKey, payload.singlePlayerHighScores)
      );
      return;
    }

    if (typeof payload.reviveTokensDelta === "number" && payload.reviveTokensDelta !== 0) {
      response.json(await progressionService.adjustReviveTokens(payload.playerKey, payload.reviveTokensDelta));
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

progressionRouter.patch("/display-name", async (request, response) => {
  try {
    const payload = request.body as UpdateDisplayNamePayload;
    response.json(await progressionService.updateDisplayName(payload.playerKey, payload.displayName));
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
    response.json(await progressionService.claimDailyReward(payload.playerKey));
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
    response.json(await progressionService.recordMatch(payload.playerKey, payload.input));
  } catch (error) {
    console.error("[progression/match]", error);
    response.status(503).json({
      message: error instanceof Error ? error.message : "Could not record the match."
    });
  }
});
