import type { Player } from "../types/game.types";
import type {
  Difficulty,
  GameOverPayload,
  GuessFeedback,
  OnlineMode,
  PublicRoom,
  RemovePlayerResult,
  ResolveRoundResult,
  SubmitGuessResult
} from "../types/game.types";
import type { RoomModel } from "../models/room.model";
import { getDifficultyConfig } from "../../../shared/difficulty";

const CLASSIC_MAX_PLAYERS = 6;
const DUEL_MAX_PLAYERS = 2;
const MIN_PLAYERS = 2;
const ROOM_CODE_LENGTH = 6;
const GUESS_MIN = 1;
export const ROUND_DURATION_MS = 15000;
export const ROUND_REVEAL_MS = 2500;

class GameService {
  private readonly rooms = new Map<string, RoomModel>();
  private readonly playerRooms = new Map<string, string>();

  createRoom(host: Player, mode: OnlineMode, difficulty: Difficulty): PublicRoom {
    const roomId = this.generateRoomId();
    const difficultyConfig = getDifficultyConfig(difficulty);
    const room: RoomModel = {
      roomId,
      players: [host],
      gameState: "waiting",
      mode,
      difficulty,
      maxNumber: difficultyConfig.maxNumber,
      maxPlayers: this.getMaxPlayersForMode(mode),
      secretNumber: 0,
      playerSecretNumbers: new Map(),
      winner: null,
      winnerIds: [],
      hostId: host.id,
      roundNumber: 0,
      roundStatus: "idle",
      roundEndsAt: null,
      roundDurationSeconds: ROUND_DURATION_MS / 1000,
      submittedPlayerIds: [],
      secretSubmittedPlayerIds: [],
      roundGuesses: new Map()
    };

    this.rooms.set(room.roomId, room);
    this.playerRooms.set(host.id, room.roomId);

    return this.toPublicRoom(room);
  }

  joinRoom(roomId: string, player: Player): PublicRoom {
    const normalizedRoomId = this.normalizeRoomId(roomId);
    const room = this.requireRoom(normalizedRoomId);

    if (room.players.length >= room.maxPlayers) {
      throw new Error("This room is full.");
    }

    if (room.gameState === "playing") {
      throw new Error("A game is already in progress.");
    }

    room.players.push(player);
    this.playerRooms.set(player.id, normalizedRoomId);

    return this.toPublicRoom(room);
  }

  startGame(roomId: string, requesterId: string): PublicRoom {
    const room = this.requireRoom(this.normalizeRoomId(roomId));

    if (room.hostId !== requesterId) {
      throw new Error("Only the host can start the game.");
    }

    if (room.mode === "duel" && room.players.length !== DUEL_MAX_PLAYERS) {
      throw new Error("Duel mode needs exactly 2 players.");
    }

    if (room.players.length < MIN_PLAYERS) {
      throw new Error("At least 2 players are required to start.");
    }

    room.gameState = "playing";
    room.winner = null;
    room.winnerIds = [];
    room.roundNumber = 0;
    room.roundEndsAt = null;
    room.submittedPlayerIds = [];
    room.roundGuesses.clear();

    if (room.mode === "duel") {
      room.roundStatus = "setup";
      room.secretNumber = 0;
      room.playerSecretNumbers.clear();
      room.secretSubmittedPlayerIds = [];
      return this.toPublicRoom(room);
    }

    room.secretSubmittedPlayerIds = [];
    room.secretNumber = this.randomNumber(GUESS_MIN, room.maxNumber);
    this.beginRound(room, 1);

    return this.toPublicRoom(room);
  }

  setSecretNumber(roomId: string, playerId: string, secretNumber: number): PublicRoom {
    const room = this.requireRoom(this.normalizeRoomId(roomId));
    const player = room.players.find((currentPlayer) => currentPlayer.id === playerId);

    if (!player) {
      throw new Error("Player is not part of this room.");
    }

    if (room.mode !== "duel") {
      throw new Error("This room does not use player-chosen secret numbers.");
    }

    if (room.gameState !== "playing" || room.roundStatus !== "setup") {
      throw new Error("Secret numbers can only be set at the start of a duel game.");
    }

    if (room.secretSubmittedPlayerIds.includes(playerId)) {
      throw new Error("You already locked in your secret number.");
    }

    room.playerSecretNumbers.set(playerId, this.validateGuess(secretNumber, room.maxNumber));
    room.secretSubmittedPlayerIds = [...room.secretSubmittedPlayerIds, playerId];

    if (room.secretSubmittedPlayerIds.length === room.players.length) {
      this.beginRound(room, 1);
    }

    return this.toPublicRoom(room);
  }

  leaveRoom(roomId: string, playerId: string): RemovePlayerResult {
    const normalizedRoomId = this.normalizeRoomId(roomId);
    const currentRoomId = this.playerRooms.get(playerId);

    if (!currentRoomId) {
      return {
        roomId: null,
        room: null,
        deleted: false,
        gameOver: null
      };
    }

    if (currentRoomId !== normalizedRoomId) {
      throw new Error("Player is not part of this room.");
    }

    return this.removePlayer(playerId);
  }

  submitGuess(roomId: string, playerId: string, guess: number): SubmitGuessResult {
    const room = this.requireRoom(this.normalizeRoomId(roomId));
    const player = room.players.find((currentPlayer) => currentPlayer.id === playerId);

    if (!player) {
      throw new Error("Player is not part of this room.");
    }

    if (room.gameState !== "playing" || room.roundStatus !== "collecting") {
      throw new Error("Wait for the next round to submit a guess.");
    }

    if (room.submittedPlayerIds.includes(playerId)) {
      throw new Error("You already submitted a guess this round.");
    }

    const normalizedGuess = this.validateGuess(guess, room.maxNumber);

    room.roundGuesses.set(playerId, normalizedGuess);
    room.submittedPlayerIds = [...room.submittedPlayerIds, playerId];

    return {
      room: this.toPublicRoom(room)
    };
  }

  resolveRound(roomId: string): ResolveRoundResult {
    const room = this.requireRoom(this.normalizeRoomId(roomId));

    if (room.gameState !== "playing" || room.roundStatus !== "collecting") {
      throw new Error("The round is not active.");
    }

    const guessResults = room.players.map((player) => {
      const submittedGuess = room.roundGuesses.get(player.id);
      const opponent =
        room.mode === "duel"
          ? room.players.find((currentPlayer) => currentPlayer.id !== player.id) ?? null
          : null;
      const opponentGuess = opponent ? room.roundGuesses.get(opponent.id) ?? null : null;

      if (submittedGuess === undefined) {
        return {
          roomId: room.roomId,
          playerId: player.id,
          roundNumber: room.roundNumber,
          guess: null,
          opponentGuess,
          result: "missed" as GuessFeedback
        };
      }

      const targetNumber = this.getTargetNumberForPlayer(room, player.id);
      let result: GuessFeedback = "higher";

      if (submittedGuess === targetNumber) {
        result = "correct";
      } else if (submittedGuess > targetNumber) {
        result = "lower";
      }

      return {
        roomId: room.roomId,
        playerId: player.id,
        roundNumber: room.roundNumber,
        guess: submittedGuess,
        opponentGuess,
        result
      };
    });

    const winnerIds =
      room.mode === "duel"
        ? guessResults.filter((result) => result.result === "correct").map((result) => result.playerId)
        : (() => {
            const firstCorrectPlayerId =
              room.submittedPlayerIds.find((playerId) => room.roundGuesses.get(playerId) === room.secretNumber) ?? null;

            return firstCorrectPlayerId ? [firstCorrectPlayerId] : [];
          })();

    let gameOver: GameOverPayload | null = null;

    if (winnerIds.length > 0) {
      room.gameState = "finished";
      room.winnerIds = winnerIds;
      room.winner = winnerIds.length === 1 ? winnerIds[0] : null;
      room.roundStatus = "idle";
      room.roundEndsAt = null;
    } else {
      room.roundStatus = "revealing";
      room.roundEndsAt = null;
      room.winner = null;
      room.winnerIds = [];
    }

    room.submittedPlayerIds = [];
    room.roundGuesses.clear();

    if (winnerIds.length > 0) {
      const winners = room.players.filter((player) => winnerIds.includes(player.id));
      gameOver = {
        room: this.toPublicRoom(room),
        winner: winners.length === 1 ? winners[0] : null,
        winners
      };
    }

    return {
      room: this.toPublicRoom(room),
      guessResults,
      gameOver
    };
  }

  startNextRound(roomId: string): PublicRoom {
    const room = this.requireRoom(this.normalizeRoomId(roomId));

    if (room.gameState !== "playing") {
      throw new Error("The game is not active.");
    }

    this.beginRound(room, room.roundNumber + 1);

    return this.toPublicRoom(room);
  }

  removePlayer(playerId: string): RemovePlayerResult {
    const roomId = this.playerRooms.get(playerId);

    if (!roomId) {
      return {
        roomId: null,
        room: null,
        deleted: false,
        gameOver: null
      };
    }

    this.playerRooms.delete(playerId);

    const room = this.rooms.get(roomId);

    if (!room) {
      return {
        roomId,
        room: null,
        deleted: false,
        gameOver: null
      };
    }

    room.players = room.players.filter((player) => player.id !== playerId);
    room.submittedPlayerIds = room.submittedPlayerIds.filter((submittedPlayerId) => submittedPlayerId !== playerId);
    room.secretSubmittedPlayerIds = room.secretSubmittedPlayerIds.filter(
      (submittedPlayerId) => submittedPlayerId !== playerId
    );
    room.playerSecretNumbers.delete(playerId);
    room.roundGuesses.delete(playerId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return {
        roomId,
        room: null,
        deleted: true,
        gameOver: null
      };
    }

    if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
    }

    let gameOver: GameOverPayload | null = null;

    if (room.gameState === "playing" && room.players.length < MIN_PLAYERS) {
      const winners = room.players.slice(0, 1);

      room.gameState = "finished";
      room.winner = winners[0]?.id ?? null;
      room.winnerIds = winners.map((winner) => winner.id);
      this.resetRoundState(room);

      if (winners[0]) {
        gameOver = {
          room: this.toPublicRoom(room),
          winner: winners[0],
          winners
        };
      }
    }

    if (room.winner === playerId || room.winnerIds.includes(playerId)) {
      room.winner = null;
      room.winnerIds = [];
      room.gameState = "waiting";
      this.resetRoundState(room);
    }

    return {
      roomId,
      room: this.toPublicRoom(room),
      deleted: false,
      gameOver
    };
  }

  private toPublicRoom(room: RoomModel): PublicRoom {
    return {
      roomId: room.roomId,
      players: [...room.players],
      gameState: room.gameState,
      mode: room.mode,
      difficulty: room.difficulty,
      maxNumber: room.maxNumber,
      maxPlayers: room.maxPlayers,
      winner: room.winner,
      winnerIds: [...room.winnerIds],
      hostId: room.hostId,
      roundNumber: room.roundNumber,
      roundStatus: room.roundStatus,
      roundEndsAt: room.roundEndsAt,
      roundDurationSeconds: room.roundDurationSeconds,
      submittedPlayerIds: [...room.submittedPlayerIds],
      secretSubmittedPlayerIds: [...room.secretSubmittedPlayerIds]
    };
  }

  private beginRound(room: RoomModel, roundNumber: number) {
    room.roundNumber = roundNumber;
    room.roundStatus = "collecting";
    room.roundEndsAt = Date.now() + ROUND_DURATION_MS;
    room.submittedPlayerIds = [];
    room.roundGuesses.clear();
  }

  private resetRoundState(room: RoomModel) {
    room.roundNumber = 0;
    room.roundStatus = "idle";
    room.roundEndsAt = null;
    room.submittedPlayerIds = [];
    room.secretSubmittedPlayerIds = [];
    room.roundGuesses.clear();
    room.playerSecretNumbers.clear();
    room.secretNumber = 0;
  }

  private getTargetNumberForPlayer(room: RoomModel, playerId: string) {
    if (room.mode === "duel") {
      const opponent = room.players.find((player) => player.id !== playerId);

      if (!opponent) {
        throw new Error("Duel mode needs an opponent.");
      }

      const opponentSecret = room.playerSecretNumbers.get(opponent.id);

      if (opponentSecret === undefined) {
        throw new Error("The opponent has not locked in a secret number.");
      }

      return opponentSecret;
    }

    return room.secretNumber;
  }

  private getMaxPlayersForMode(mode: OnlineMode) {
    return mode === "duel" ? DUEL_MAX_PLAYERS : CLASSIC_MAX_PLAYERS;
  }

  private requireRoom(roomId: string): RoomModel {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new Error("Room not found.");
    }

    return room;
  }

  private generateRoomId(): string {
    let roomId = "";

    do {
      roomId = Math.random().toString(36).slice(2, 2 + ROOM_CODE_LENGTH).toUpperCase();
    } while (this.rooms.has(roomId));

    return roomId;
  }

  private normalizeRoomId(roomId: string) {
    return roomId.trim().toUpperCase();
  }

  private validateGuess(guess: number, maxNumber: number) {
    if (!Number.isInteger(guess) || guess < GUESS_MIN || guess > maxNumber) {
      throw new Error(`Guesses must be whole numbers between 1 and ${maxNumber}.`);
    }

    return guess;
  }

  private randomNumber(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

export const gameService = new GameService();
