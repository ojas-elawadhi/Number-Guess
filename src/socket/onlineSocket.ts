import { io, type Socket } from "socket.io-client";

import { useOnlineGameStore } from "../store/useOnlineGameStore";
import type {
  ClientToServerEvents,
  CreateOrJoinRoomResponse,
  Difficulty,
  OnlineMode,
  ServerToClientEvents,
  SocketAck,
  StartGameResponse
} from "../types/game.types";

const SOCKET_CONNECT_TIMEOUT_MS = 10000;
const SOCKET_ACK_TIMEOUT_MS = 8000;

const normalizeSocketUrl = (value?: string) => {
  if (!value) {
    return "http://localhost:3001";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.includes("localhost") || /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(value)) {
    return `http://${value}`;
  }

  return `https://${value}`;
};

const SOCKET_URL = normalizeSocketUrl(process.env.EXPO_PUBLIC_SOCKET_URL ?? process.env.EXPO_PUBLIC_API_URL);

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let listenersBound = false;

const ensureConnected = async () => {
  const activeSocket = getSocket();

  if (activeSocket.connected) {
    return activeSocket;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Could not connect to the game server. Try again in a moment."));
    }, SOCKET_CONNECT_TIMEOUT_MS);

    const handleConnect = () => {
      cleanup();
      resolve();
    };

    const handleConnectError = (error: Error) => {
      cleanup();
      reject(new Error(error.message || "Could not connect to the game server."));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      activeSocket.off("connect", handleConnect);
      activeSocket.off("connect_error", handleConnectError);
    };

    activeSocket.once("connect", handleConnect);
    activeSocket.once("connect_error", handleConnectError);
    activeSocket.connect();
  });

  return activeSocket;
};

const emitWithAck = <T>(emitter: (ack: SocketAck<T>) => void) =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Could not reach the game server. Check the backend URL and try again."));
    }, SOCKET_ACK_TIMEOUT_MS);

    emitter((response) => {
      clearTimeout(timeout);

      if (response.success) {
        resolve(response.data);
        return;
      }

      reject(new Error(response.message));
    });
  });

const bindListeners = (activeSocket: Socket<ServerToClientEvents, ClientToServerEvents>) => {
  if (listenersBound) {
    return;
  }

  activeSocket.on("connect", () => {
    useOnlineGameStore.getState().setConnectionStatus(true);
  });

  activeSocket.on("disconnect", () => {
    useOnlineGameStore.getState().setConnectionStatus(false);
  });

  activeSocket.on("room_update", ({ room }) => {
    useOnlineGameStore.getState().setRoom(room);
  });

  activeSocket.on("game_started", (payload) => {
    useOnlineGameStore.getState().setGameStarted(payload);
  });

  activeSocket.on("guess_result", (payload) => {
    useOnlineGameStore.getState().setGuessResult(payload);
  });

  activeSocket.on("game_over", (payload) => {
    useOnlineGameStore.getState().setGameOver(payload);
  });

  listenersBound = true;
};

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false
    });
  }

  bindListeners(socket);

  return socket;
};

export const connectSocket = () => {
  const activeSocket = getSocket();

  if (!activeSocket.connected) {
    activeSocket.connect();
  }

  return activeSocket;
};

export const createRoom = async (playerName: string, mode: OnlineMode, difficulty: Difficulty) => {
  const activeSocket = await ensureConnected();

  return emitWithAck<CreateOrJoinRoomResponse>((ack) => {
    activeSocket.emit("create_room", { playerName, mode, difficulty }, ack);
  });
};

export const joinRoom = async (roomId: string, playerName: string) => {
  const activeSocket = await ensureConnected();

  return emitWithAck<CreateOrJoinRoomResponse>((ack) => {
    activeSocket.emit("join_room", { roomId, playerName }, ack);
  });
};

export const startGame = async (roomId: string) => {
  const activeSocket = await ensureConnected();

  return emitWithAck<StartGameResponse>((ack) => {
    activeSocket.emit("start_game", { roomId }, ack);
  });
};

export const setSecretNumber = async (roomId: string, secretNumber: number) => {
  const activeSocket = await ensureConnected();

  return emitWithAck<void>((ack) => {
    activeSocket.emit("set_secret_number", { roomId, secretNumber }, ack);
  });
};

export const leaveRoom = async (roomId: string) => {
  const activeSocket = await ensureConnected();

  return emitWithAck<void>((ack) => {
    activeSocket.emit("leave_room", { roomId }, ack);
  });
};

export const makeGuess = async (roomId: string, guess: number) => {
  const activeSocket = await ensureConnected();

  return emitWithAck<void>((ack) => {
    activeSocket.emit("make_guess", { roomId, guess }, ack);
  });
};
