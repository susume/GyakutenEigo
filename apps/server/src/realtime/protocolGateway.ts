import type { Server, Socket } from "socket.io";
import type { RealtimeEventBus } from "../scaling/runtimeInfrastructure.js";
import type { GameSession, LearningPulse, PlayerSession } from "@quizstrike/shared";
import {
  CLIENT_COMMAND_TYPES,
  LEGACY_PROTOCOL_VERSION,
  MAX_SUPPORTED_PROTOCOL_VERSION,
  MIN_SUPPORTED_PROTOCOL_VERSION,
  PROTOCOL_VERSION,
  isSupportedProtocolVersion,
  validateClientCommand,
  type ClientCommand,
  type ClientCommandType,
  type ProtocolErrorCode,
  type ProtocolErrorEvent,
  type ServerHelloEvent
} from "@quizstrike/shared";

type ProtocolSocketData = {
  protocolVersion?: number;
  protocolReady?: boolean;
  legacyProtocol?: boolean;
  protocolRejected?: boolean;
};

const commandTypes = new Set<string>(CLIENT_COMMAND_TYPES);

export interface RoomEventPublisherOptions {
  eventBus: RealtimeEventBus;
  channel: string;
  instanceId: string;
}

/** Transport-facing room-event publication with the existing error behavior. */
export const createRoomEventPublisher = ({ eventBus, channel, instanceId }: RoomEventPublisherOptions) => (
  roomId: string,
  eventType: string,
  eventId: string,
  payload: unknown
) => {
  void eventBus.publish(channel, {
    eventId,
    originInstanceId: instanceId,
    roomId,
    eventType,
    occurredAt: Date.now(),
    payload
  }).catch((error: unknown) => {
    console.error(`[event-bus] failed to publish ${eventType} for room ${roomId}`, error);
  });
};

export interface RoomBroadcastOptions {
  io: Server;
  stampSession: (session: GameSession) => GameSession;
  stampTeacherSession: (session: GameSession) => GameSession;
  getLearningPulse: (session: GameSession) => LearningPulse;
  teacherRoom: (sessionCode: string) => string;
  schedulePersistence: () => void;
  sessionBroadcastWindowMs: number;
}

/** Owns room-scoped protocol formatting and coalesced state broadcasts. */
export const createRoomBroadcaster = ({
  io,
  stampSession,
  stampTeacherSession,
  getLearningPulse,
  teacherRoom,
  schedulePersistence,
  sessionBroadcastWindowMs
}: RoomBroadcastOptions) => {
  const pendingSessions = new Map<string, GameSession>();
  let sessionTimer: ReturnType<typeof setTimeout> | undefined;

  const flushSessionBroadcasts = () => {
    sessionTimer = undefined;
    for (const session of pendingSessions.values()) {
      io.to(session.sessionCode).emit("session_state", stampSession(session));
      io.to(teacherRoom(session.sessionCode)).emit("session_state", stampTeacherSession(session));
    }
    pendingSessions.clear();
  };

  const broadcastSession = (session: GameSession) => {
    pendingSessions.set(session.sessionCode, session);
    sessionTimer ??= setTimeout(flushSessionBroadcasts, sessionBroadcastWindowMs);
    schedulePersistence();
  };

  const broadcastPlayerState = (session: GameSession, players: PlayerSession[]) => {
    const uniquePlayers = [...new Map(players.map((player) => [player.id, player])).values()];
    const publicState = {
      players: uniquePlayers,
      flag: session.flag,
      recentEvents: session.events?.slice(0, 2)
    };
    io.to(session.sessionCode).emit("player_state", publicState);
    io.to(teacherRoom(session.sessionCode)).emit("player_state", {
      ...publicState,
      learningPulse: getLearningPulse(session)
    });
    schedulePersistence();
  };

  return { broadcastSession, broadcastPlayerState, flushSessionBroadcasts, clearTimer: () => { if (sessionTimer) clearTimeout(sessionTimer); sessionTimer = undefined; } };
};

export const resolveProtocolAdmission = (version: number) =>
  isSupportedProtocolVersion(version)
    ? { accepted: true as const, protocolVersion: PROTOCOL_VERSION }
    : {
        accepted: false as const,
        code: "UNSUPPORTED_VERSION" as const,
        message: `This client uses protocol ${version}; the server supports ${MIN_SUPPORTED_PROTOCOL_VERSION}-${MAX_SUPPORTED_PROTOCOL_VERSION}.`
      };

export const createProtocolError = (
  code: ProtocolErrorCode,
  message: string,
  recoverable: boolean,
  requestId?: string
): ProtocolErrorEvent => ({
  type: "protocol_error",
  code,
  message,
  ...(requestId ? { requestId } : {}),
  recoverable,
  occurredAt: Date.now()
});

export const sendProtocolError = (
  socket: Socket,
  code: ProtocolErrorCode,
  message: string,
  recoverable = true,
  requestId?: string
) => socket.emit("protocol_error", createProtocolError(code, message, recoverable, requestId));

/**
 * Registers the version handshake and a narrow version-0 rollout adapter.
 * Version 0 is inferred only when a known legacy event arrives before hello.
 */
export const registerProtocolHandshake = (
  socket: Socket,
  options: { serverVersion?: string; onLegacyClient?: (socketId: string) => void } = {}
) => {
  const data = socket.data as ProtocolSocketData;

  socket.on("client_hello", (payload: unknown) => {
    const parsed = validateClientCommand("client_hello", payload);
    if (!parsed.success || parsed.data.type !== "client_hello") {
      sendProtocolError(socket, parsed.success ? "INVALID_MESSAGE" : parsed.code, parsed.success ? "Invalid handshake." : parsed.message, false);
      data.protocolRejected = true;
      socket.disconnect(true);
      return;
    }

    const admission = resolveProtocolAdmission(parsed.data.protocolVersion);
    if (!admission.accepted) {
      sendProtocolError(socket, admission.code, admission.message, false);
      data.protocolRejected = true;
      socket.disconnect(true);
      return;
    }

    data.protocolVersion = admission.protocolVersion;
    data.protocolReady = true;
    data.legacyProtocol = false;
    const hello: ServerHelloEvent = {
      type: "server_hello",
      protocolVersion: PROTOCOL_VERSION,
      minimumSupportedVersion: MIN_SUPPORTED_PROTOCOL_VERSION,
      maximumSupportedVersion: MAX_SUPPORTED_PROTOCOL_VERSION,
      ...(options.serverVersion ? { serverVersion: options.serverVersion } : {}),
      connectionId: socket.id,
      serverTime: Date.now()
    };
    socket.emit("server_hello", hello);
  });

  socket.onAny((eventName) => {
    if (eventName === "client_hello") return;
    if (!commandTypes.has(eventName)) {
      sendProtocolError(socket, "UNKNOWN_MESSAGE", `Unknown client event: ${String(eventName).slice(0, 80)}`, true);
      return;
    }
    if (!data.protocolReady && !data.protocolRejected) {
      data.protocolVersion = LEGACY_PROTOCOL_VERSION;
      data.protocolReady = true;
      data.legacyProtocol = true;
      options.onLegacyClient?.(socket.id);
    }
  });
};

export const parseSocketCommand = <TType extends ClientCommandType>(
  socket: Socket,
  type: TType,
  payload: unknown
): Extract<ClientCommand, { type: TType }> | undefined => {
  const data = socket.data as ProtocolSocketData;
  if (data.protocolRejected) return undefined;
  if (!data.protocolReady) {
    // onAny normally installs the version-0 adapter first; this fallback keeps
    // ordering explicit if Socket.IO changes listener scheduling.
    data.protocolVersion = LEGACY_PROTOCOL_VERSION;
    data.protocolReady = true;
    data.legacyProtocol = true;
  }
  const normalizedPayload = data.legacyProtocol ? adaptLegacyPayload(type, payload) : payload;
  const parsed = validateClientCommand(type, normalizedPayload);
  if (!parsed.success) {
    const requestId = payload && typeof payload === "object" && "requestId" in payload
      ? String((payload as { requestId?: unknown }).requestId ?? "").slice(0, 128) || undefined
      : undefined;
    sendProtocolError(socket, parsed.code, parsed.message, true, requestId);
    return undefined;
  }
  return parsed.data as Extract<ClientCommand, { type: TType }>;
};

/** Remove credentials that version-0 clients repeated after room binding. */
export const adaptLegacyPayload = (type: ClientCommandType, payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  if (type !== "player_position" && type !== "fire_action" && type !== "flag_action") return payload;
  const { code: _code, playerId: _playerId, playerToken: _playerToken, ...canonical } = payload as Record<string, unknown>;
  return canonical;
};
