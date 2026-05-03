import { Router } from "express";

import { progressionService } from "../services/progression.service";
import type {
  ClaimDailyRewardPayload,
  ProgressBootstrapPayload,
  ProgressPreferencesPayload,
  RecordMatchPayload
} from "../../../shared/progression.types";

export const progressionRouter = Router();

progressionRouter.post("/bootstrap", async (request, response) => {
  try {
    const payload = request.body as ProgressBootstrapPayload;
    const result = await progressionService.bootstrap(payload);
    response.json(result);
  } catch (error) {
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

    response.status(400).json({
      message: "No supported preference update was provided."
    });
  } catch (error) {
    response.status(503).json({
      message: error instanceof Error ? error.message : "Could not update progression preferences."
    });
  }
});

progressionRouter.post("/daily-reward", async (request, response) => {
  try {
    const payload = request.body as ClaimDailyRewardPayload;
    response.json(await progressionService.claimDailyReward(payload.playerKey));
  } catch (error) {
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
    response.status(503).json({
      message: error instanceof Error ? error.message : "Could not record the match."
    });
  }
});
