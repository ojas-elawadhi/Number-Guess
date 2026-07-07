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

    if (payload.tutorialSeen === true) {
      response.json(withSessionToken(await progressionService.markTutorialSeen(payload.playerKey)));
      return;
    }

    if (typeof payload.soundPlaceholdersEnabled === "boolean") {
      response.json(
        withSessionToken(
          await progressionService.setSoundPlaceholdersEnabled(payload.playerKey, payload.soundPlaceholdersEnabled)
        )
      );
      return;
    }

    if (typeof payload.avatarId === "string") {
      response.json(withSessionToken(await progressionService.updateAvatarId(payload.playerKey, payload.avatarId)));
      return;
    }

    if (typeof payload.premiumAvatarId === "string") {
      response.json(
        withSessionToken(
          await progressionService.purchasePremiumAvatar(
            payload.playerKey,
            payload.premiumAvatarId
          )
        )
      );
      return;
    }

    if (payload.singlePlayerHighRounds && Object.keys(payload.singlePlayerHighRounds).length > 0) {
      response.json(
        withSessionToken(
          await progressionService.updateSinglePlayerHighRounds(payload.playerKey, payload.singlePlayerHighRounds)
        )
      );
      return;
    }

    if (payload.singlePlayerHighScores && Object.keys(payload.singlePlayerHighScores).length > 0) {
      response.json(
        withSessionToken(
          await progressionService.updateSinglePlayerHighScores(payload.playerKey, payload.singlePlayerHighScores)
        )
      );
      return;
    }

    if (typeof payload.extraGuessPowerUpsDelta === "number" && payload.extraGuessPowerUpsDelta !== 0) {
      response.json(
        withSessionToken(
          await progressionService.adjustExtraGuessPowerUps(payload.playerKey, payload.extraGuessPowerUpsDelta)
        )
      );
      return;
    }

    if (typeof payload.skipBoostersDelta === "number" && payload.skipBoostersDelta !== 0) {
      response.json(withSessionToken(await progressionService.adjustSkipBoosters(payload.playerKey, payload.skipBoostersDelta)));
      return;
    }

    if (typeof payload.coinsDelta === "number" && payload.coinsDelta !== 0) {
      response.json(withSessionToken(await progressionService.adjustCoins(payload.playerKey, payload.coinsDelta)));
      return;
    }

    if (payload.activePracticeRun) {
      response.json(
        withSessionToken(
          await progressionService.updateActivePracticeRun(
            payload.playerKey,
            payload.activePracticeRun.difficulty,
            payload.activePracticeRun.snapshot
          )
        )
      );
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
