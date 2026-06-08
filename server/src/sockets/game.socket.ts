import type { Server } from "socket.io";

import { gameService, ROUND_DURATION_MS, ROUND_REVEAL_MS } from "../services/game.service";
import type {
  ClientToServerEvents,
  CreateOrJoinRoomResponse,
  ServerToClientEvents,
  SocketAck,
  StartGameResponse
} from "../types/game.types";

const sendSuccess = <T>(ack: SocketAck<T> | undefined, data: T) => {
  ack?.({
    success: true,
    data
  });
};

const sendFailure = <T>(ack: SocketAck<T> | undefined, error: unknown) => {
  ack?.({
    success: false,
    message: error instanceof Error ? error.message : "Something went wrong."
  });
};

export const registerGameSocketHandlers = (
  io: Server<ClientToServerEvents, ServerToClientEvents>
) => {
  const roundTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  const revealTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  const normalizeRoomId = (roomId: string) => roomId.trim().toUpperCase();
  const normalizePlayerName = (playerName: string) => playerName.trim() || "Player";

  const clearRoomTimers = (roomId: string) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    const roundTimeout = roundTimeouts.get(normalizedRoomId);
    const revealTimeout = revealTimeouts.get(normalizedRoomId);

    if (roundTimeout) {
      clearTimeout(roundTimeout);
      roundTimeouts.delete(normalizedRoomId);
    }

    if (revealTimeout) {
      clearTimeout(revealTimeout);
      revealTimeouts.delete(normalizedRoomId);
    }
  };

  const scheduleNextRound = (roomId: string) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    clearRoomTimers(normalizedRoomId);
    const revealTimeout = setTimeout(() => {
      revealTimeouts.delete(normalizedRoomId);

      try {
        const room = gameService.startNextRound(normalizedRoomId);
        io.to(room.roomId).emit("room_update", { room });
        scheduleRoundResolution(normalizedRoomId);
      } catch (error) {
        console.error(`Could not start next round for ${normalizedRoomId}:`, error);
      }
    }, ROUND_REVEAL_MS);

    revealTimeouts.set(normalizedRoomId, revealTimeout);
  };

  const scheduleRoundResolution = (roomId: string) => {
    const normalizedRoomId = normalizeRoomId(roomId);
    clearRoomTimers(normalizedRoomId);
    const roundTimeout = setTimeout(() => {
      roundTimeouts.delete(normalizedRoomId);

      try {
        const result = gameService.resolveRound(normalizedRoomId);

        io.to(result.room.roomId).emit("room_update", { room: result.room });
        result.guessResults.forEach((guessResult) => {
          io.to(guessResult.playerId).emit("guess_result", guessResult);
        });

        if (result.gameOver) {
          clearRoomTimers(normalizedRoomId);
          io.to(result.room.roomId).emit("game_over", result.gameOver);
          return;
        }

        scheduleNextRound(normalizedRoomId);
      } catch (error) {
        console.error(`Could not resolve round for ${normalizedRoomId}:`, error);
      }
    }, ROUND_DURATION_MS);

    roundTimeouts.set(normalizedRoomId, roundTimeout);
  };

  io.on("connection", (socket) => {
    socket.on("create_room", (payload, ack) => {
      try {
        const player = {
          id: socket.id,
          name: normalizePlayerName(payload.playerName)
        };
        const room = gameService.createRoom(player, payload.mode, payload.difficulty);

        socket.join(room.roomId);
        io.to(room.roomId).emit("room_update", { room });
        sendSuccess<CreateOrJoinRoomResponse>(ack, { room, player });
      } catch (error) {
        sendFailure(ack, error);
      }
    });

    socket.on("join_room", (payload, ack) => {
      try {
        const player = {
          id: socket.id,
          name: normalizePlayerName(payload.playerName)
        };
        const room = gameService.joinRoom(payload.roomId, player);

        socket.join(room.roomId);
        io.to(room.roomId).emit("room_update", { room });
        sendSuccess<CreateOrJoinRoomResponse>(ack, { room, player });
      } catch (error) {
        sendFailure(ack, error);
      }
    });

    socket.on("start_game", (payload, ack) => {
      try {
        const room = gameService.startGame(payload.roomId, socket.id);

        clearRoomTimers(room.roomId);
        io.to(room.roomId).emit("game_started", { room });
        if (room.roundStatus === "collecting") {
          scheduleRoundResolution(room.roomId);
        }
        sendSuccess<StartGameResponse>(ack, { room });
      } catch (error) {
        sendFailure(ack, error);
      }
    });

    socket.on("set_secret_number", (payload, ack) => {
      try {
        const room = gameService.setSecretNumber(payload.roomId, socket.id, payload.secretNumber);

        io.to(room.roomId).emit("room_update", { room });

        if (room.roundStatus === "collecting") {
          scheduleRoundResolution(room.roomId);
        }

        sendSuccess<void>(ack, undefined);
      } catch (error) {
        sendFailure(ack, error);
      }
    });

    socket.on("leave_room", (payload, ack) => {
      try {
        const result = gameService.leaveRoom(payload.roomId, socket.id);
        const normalizedRoomId = normalizeRoomId(payload.roomId);

        socket.leave(normalizedRoomId);

        if (result.room && !result.deleted) {
          io.to(result.room.roomId).emit("room_update", { room: result.room });

          if (result.gameOver) {
            clearRoomTimers(result.room.roomId);
            io.to(result.room.roomId).emit("game_over", result.gameOver);
          }
        } else {
          clearRoomTimers(result.roomId ?? normalizedRoomId);
        }

        sendSuccess<void>(ack, undefined);
      } catch (error) {
        sendFailure(ack, error);
      }
    });

    socket.on("make_guess", (payload, ack) => {
      try {
        const result = gameService.submitGuess(payload.roomId, socket.id, payload.guess);

        io.to(result.room.roomId).emit("room_update", { room: result.room });

        sendSuccess<void>(ack, undefined);
      } catch (error) {
        sendFailure(ack, error);
      }
    });

    socket.on("disconnect", () => {
      const result = gameService.removePlayer(socket.id);

      if (!result.room || result.deleted) {
        if (result.roomId) {
          clearRoomTimers(result.roomId);
        }
        return;
      }

      io.to(result.room.roomId).emit("room_update", { room: result.room });

      if (result.gameOver) {
        clearRoomTimers(result.room.roomId);
        io.to(result.room.roomId).emit("game_over", result.gameOver);
      }
    });
  });
};
