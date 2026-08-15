import { io, type Socket } from "socket.io-client";
import {
  ServerHelloSchema,
  createClientHello,
  type JoinSessionRoomCommand,
  type ProtocolErrorEvent
} from "@quizstrike/shared";
import { getApiUrl } from "../../api/client.js";

export type RoomJoinPayload = Omit<JoinSessionRoomCommand, "type">;

export interface MultiplayerConnectionOptions {
  onProtocolError?: (error: ProtocolErrorEvent) => void;
}

export const SOCKET_IO_PATH = "/socket.io/";

/**
 * Owns socket construction and the protocol handshake. Feature code receives
 * the connected Socket.IO transport only after this layer has installed its
 * lifecycle listeners, avoiding duplicate hello/join listeners on reconnect.
 */
export const createMultiplayerSocket = (
  roomJoin: RoomJoinPayload,
  options: MultiplayerConnectionOptions = {}
): Socket => {
  const socket = io(getApiUrl(), {
    autoConnect: false,
    path: SOCKET_IO_PATH,
    // Start with long polling and let Engine.IO upgrade to WebSocket. Some
    // school networks allow polling but block WebSocket upgrades.
    transports: ["polling", "websocket"],
    upgrade: true,
    timeout: 10_000,
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000
  });
  let joinedConnectionId: string | undefined;

  socket.on("connect", () => {
    socket.emit("client_hello", createClientHello(import.meta.env.VITE_APP_VERSION));
  });

  socket.on("server_hello", (payload: unknown) => {
    const hello = ServerHelloSchema.safeParse(payload);
    if (!hello.success || joinedConnectionId === hello.data.connectionId) return;
    joinedConnectionId = hello.data.connectionId;
    socket.emit("join_session_room", roomJoin);
  });

  socket.on("protocol_error", (error: ProtocolErrorEvent) => {
    options.onProtocolError?.(error);
  });

  socket.connect();
  return socket;
};
