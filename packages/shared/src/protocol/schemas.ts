import { z } from "zod";
import type {
  FlagPlantedEvent,
  FreezeStreakAnnouncementEvent,
  GameSession,
  LearningPulse,
  LearningPulseQuestion
} from "../index.js";
import {
  MAX_PROTOCOL_MESSAGE_BYTES,
  MAX_SUPPORTED_PROTOCOL_VERSION,
  MIN_SUPPORTED_PROTOCOL_VERSION,
  PROTOCOL_VERSION
} from "./version.js";

const boundedId = z.string().trim().min(1).max(128);
const boundedToken = z.string().min(1).max(4096);
const finiteCoordinate = z.number().finite().min(-10_000).max(10_000);
const facing = z.number().finite().min(-Math.PI * 8).max(Math.PI * 8);

export const ClientHelloSchema = z.object({
  type: z.literal("client_hello"),
  protocolVersion: z.number().int().min(0).max(10_000),
  clientVersion: z.string().trim().min(1).max(80).optional(),
  capabilities: z.array(z.string().trim().min(1).max(64)).max(16).optional()
}).strict();

export const JoinSessionRoomCommandSchema = z.object({
  type: z.literal("join_session_room"),
  code: z.string().trim().min(4).max(12).regex(/^[A-Za-z0-9]+$/),
  playerId: boundedId.optional(),
  playerToken: boundedToken.optional(),
  teacherToken: boundedToken.optional()
}).strict().superRefine((value, context) => {
  const studentCredentials = Boolean(value.playerId && value.playerToken);
  const teacherCredentials = Boolean(value.teacherToken);
  if (studentCredentials === teacherCredentials) {
    context.addIssue({
      code: "custom",
      message: "Provide either student credentials or a teacher token."
    });
  }
});

export const AnswerQuestionCommandSchema = z.object({
  type: z.literal("answer_question"),
  questionId: boundedId,
  selectedChoice: z.enum(["A", "B", "C", "D"])
}).strict();

export const BuyGearCommandSchema = z.object({
  type: z.literal("buy_gear"),
  gearId: z.string().trim().min(1).max(64)
}).strict();

export const BuySnowballsCommandSchema = z.object({
  type: z.literal("buy_snowballs"),
  packSize: z.enum(["standard", "large"]).optional()
}).strict();

const positionFields = {
  x: finiteCoordinate,
  z: finiteCoordinate,
  y: finiteCoordinate.optional(),
  facing: facing.optional()
};

export const PlayerPositionCommandSchema = z.object({
  type: z.literal("player_position"),
  ...positionFields,
  sprinting: z.boolean().optional(),
  crouching: z.boolean().optional(),
  jumping: z.boolean().optional()
}).strict();

export const FireActionCommandSchema = z.object({
  type: z.literal("fire_action"),
  requestId: boundedId,
  ...positionFields,
  pitch: z.number().finite().min(-Math.PI).max(Math.PI).optional(),
  targetId: boundedId.optional(),
  scoped: z.boolean().optional(),
  zoomLevel: z.number().int().min(0).max(2).optional()
}).strict();

export const FlagActionCommandSchema = z.object({
  type: z.literal("flag_action"),
  ...positionFields
}).strict();

const DiscriminatedClientCommandSchema = z.discriminatedUnion("type", [
  ClientHelloSchema,
  AnswerQuestionCommandSchema,
  BuyGearCommandSchema,
  BuySnowballsCommandSchema,
  PlayerPositionCommandSchema,
  FireActionCommandSchema,
  FlagActionCommandSchema
]);

// The join schema has a superRefinement and therefore wraps the fast
// discriminated union as one additional branch.
export const ClientCommandSchema = z.union([
  DiscriminatedClientCommandSchema,
  JoinSessionRoomCommandSchema
]);

export type ClientHello = z.infer<typeof ClientHelloSchema>;
export type JoinSessionRoomCommand = z.infer<typeof JoinSessionRoomCommandSchema>;
export type AnswerQuestionCommand = z.infer<typeof AnswerQuestionCommandSchema>;
export type BuyGearCommand = z.infer<typeof BuyGearCommandSchema>;
export type BuySnowballsCommand = z.infer<typeof BuySnowballsCommandSchema>;
export type PlayerPositionCommand = z.infer<typeof PlayerPositionCommandSchema>;
export type FireActionCommand = z.infer<typeof FireActionCommandSchema>;
export type FlagActionCommand = z.infer<typeof FlagActionCommandSchema>;

export type ClientCommand =
  | ClientHello
  | JoinSessionRoomCommand
  | AnswerQuestionCommand
  | BuyGearCommand
  | BuySnowballsCommand
  | PlayerPositionCommand
  | FireActionCommand
  | FlagActionCommand;

export type ClientCommandType = ClientCommand["type"];

export const CLIENT_COMMAND_TYPES = [
  "client_hello",
  "join_session_room",
  "answer_question",
  "buy_gear",
  "buy_snowballs",
  "player_position",
  "fire_action",
  "flag_action"
] as const satisfies readonly ClientCommandType[];

const clientCommandSchemas: Record<ClientCommandType, z.ZodType> = {
  client_hello: ClientHelloSchema,
  join_session_room: JoinSessionRoomCommandSchema,
  answer_question: AnswerQuestionCommandSchema,
  buy_gear: BuyGearCommandSchema,
  buy_snowballs: BuySnowballsCommandSchema,
  player_position: PlayerPositionCommandSchema,
  fire_action: FireActionCommandSchema,
  flag_action: FlagActionCommandSchema
};

export type ProtocolErrorCode =
  | "INVALID_MESSAGE"
  | "MESSAGE_TOO_LARGE"
  | "UNKNOWN_MESSAGE"
  | "UNSUPPORTED_VERSION"
  | "HANDSHAKE_REQUIRED"
  | "UNAUTHORIZED"
  | "INVALID_STATE"
  | "RATE_LIMITED";

export interface ProtocolErrorEvent {
  type: "protocol_error";
  code: ProtocolErrorCode;
  message: string;
  requestId?: string;
  recoverable: boolean;
  occurredAt: number;
}

export interface ServerHelloEvent {
  type: "server_hello";
  protocolVersion: number;
  minimumSupportedVersion: number;
  maximumSupportedVersion: number;
  serverVersion?: string;
  connectionId: string;
  serverTime: number;
}

export const ServerHelloSchema: z.ZodType<ServerHelloEvent> = z.object({
  type: z.literal("server_hello"),
  protocolVersion: z.number().int().min(1),
  minimumSupportedVersion: z.number().int().min(1),
  maximumSupportedVersion: z.number().int().min(1),
  serverVersion: z.string().trim().min(1).max(80).optional(),
  connectionId: boundedId,
  serverTime: z.number().int().nonnegative()
}).strict();

export const ProtocolErrorSchema: z.ZodType<ProtocolErrorEvent> = z.object({
  type: z.literal("protocol_error"),
  code: z.enum([
    "INVALID_MESSAGE",
    "MESSAGE_TOO_LARGE",
    "UNKNOWN_MESSAGE",
    "UNSUPPORTED_VERSION",
    "HANDSHAKE_REQUIRED",
    "UNAUTHORIZED",
    "INVALID_STATE",
    "RATE_LIMITED"
  ]),
  message: z.string().trim().min(1).max(240),
  requestId: boundedId.optional(),
  recoverable: z.boolean(),
  occurredAt: z.number().int().nonnegative()
}).strict();

export const FlagPlantedEventSchema: z.ZodType<FlagPlantedEvent> = z.object({
  type: z.literal("flag_planted"),
  eventId: boundedId,
  objectiveId: boundedId,
  plantedByPlayerId: boundedId,
  plantedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative()
}).strict().refine((event) => event.expiresAt >= event.plantedAt, {
  message: "Flag expiry must not precede the planting time."
});

export const FreezeStreakAnnouncementEventSchema: z.ZodType<FreezeStreakAnnouncementEvent> = z.object({
  type: z.literal("freeze_streak_announcement"),
  eventId: boundedId,
  playerId: boundedId,
  playerName: z.string().trim().min(1).max(80),
  streak: z.number().int().min(3).max(8),
  announcementKey: z.enum([
    "STREAK_HEATING_UP",
    "STREAK_DOMINATING",
    "STREAK_UNSTOPPABLE",
    "STREAK_WICKED_SICK",
    "STREAK_MONSTER",
    "STREAK_GODLIKE"
  ]),
  occurredAt: z.number().int().nonnegative()
}).strict();

const LearningPulseQuestionSchema: z.ZodType<LearningPulseQuestion> = z.object({
  questionId: boundedId,
  prompt: z.string().trim().min(1).max(140),
  correct: z.number().int().nonnegative(),
  attempts: z.number().int().positive(),
  accuracy: z.number().int().min(0).max(100)
}).strict().refine((question) => question.correct <= question.attempts, {
  message: "Correct answers cannot exceed attempts."
});

const LearningPulseSchema: z.ZodType<LearningPulse> = z.object({
  classAccuracy: z.number().int().min(0).max(100).nullable(),
  answersSubmitted: z.number().int().nonnegative(),
  studentsNeedingReview: z.number().int().nonnegative(),
  difficultQuestion: LearningPulseQuestionSchema.optional(),
  strongestQuestion: LearningPulseQuestionSchema.optional()
}).strict();

const SessionSnapshotSchema: z.ZodType<GameSession> = z.object({
  id: boundedId,
  teacherId: boundedId,
  quizSetId: boundedId,
  sessionCode: z.string().trim().min(4).max(12),
  status: z.enum(["waiting", "active", "paused", "ended"]),
  controlState: z.enum(["running", "teacher_paused"]).optional(),
  teacherPausedAt: z.string().min(1).max(64).optional(),
  maxPlayers: z.number().int().min(1).max(100),
  currentRound: z.number().int().min(1),
  settings: z.object({}).passthrough(),
  players: z.array(z.object({
    id: boundedId,
    gameSessionId: boundedId,
    nickname: z.string().min(1).max(80),
    team: z.enum(["blue", "red"]),
    money: z.number().finite(),
    isAlive: z.boolean(),
    score: z.number().finite(),
    correctAnswers: z.number().int().nonnegative(),
    wrongAnswers: z.number().int().nonnegative(),
    gear: z.string().min(1).max(64),
    joinedAt: z.string().min(1).max(64)
  }).passthrough()).max(100),
  learningPulse: LearningPulseSchema.optional(),
  createdAt: z.string().min(1).max(64)
}).passthrough() as unknown as z.ZodType<GameSession>;

export type ServerEvent =
  | ServerHelloEvent
  | ProtocolErrorEvent
  | FlagPlantedEvent
  | FreezeStreakAnnouncementEvent
  | { type: "session_state"; session: GameSession };

export type ValidationFailure = {
  success: false;
  code: "INVALID_MESSAGE" | "MESSAGE_TOO_LARGE" | "UNKNOWN_MESSAGE";
  message: string;
};

export type ValidationSuccess<T> = { success: true; data: T };
export type ProtocolValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const serializedByteLength = (value: unknown) => {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

export const validateClientCommand = (
  type: string,
  payload: unknown
): ProtocolValidationResult<ClientCommand> => {
  if (serializedByteLength(payload) > MAX_PROTOCOL_MESSAGE_BYTES) {
    return { success: false, code: "MESSAGE_TOO_LARGE", message: "The message exceeded the protocol size limit." };
  }
  if (!(CLIENT_COMMAND_TYPES as readonly string[]).includes(type)) {
    return { success: false, code: "UNKNOWN_MESSAGE", message: "The message type is not supported." };
  }
  const body = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const parsed = clientCommandSchemas[type as ClientCommandType].safeParse({ type, ...body });
  if (!parsed.success) {
    return { success: false, code: "INVALID_MESSAGE", message: parsed.error.issues[0]?.message ?? "The message payload is invalid." };
  }
  return { success: true, data: parsed.data as ClientCommand };
};

export const validateSessionSnapshot = (payload: unknown): ProtocolValidationResult<GameSession> => {
  if (serializedByteLength(payload) > MAX_PROTOCOL_MESSAGE_BYTES * 8) {
    return { success: false, code: "MESSAGE_TOO_LARGE", message: "The session snapshot exceeded the client safety limit." };
  }
  const parsed = SessionSnapshotSchema.safeParse(payload);
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, code: "INVALID_MESSAGE", message: parsed.error.issues[0]?.message ?? "The session snapshot is invalid." };
};

export const isSupportedProtocolVersion = (version: number) =>
  Number.isInteger(version)
  && version >= MIN_SUPPORTED_PROTOCOL_VERSION
  && version <= MAX_SUPPORTED_PROTOCOL_VERSION;

export const createClientHello = (clientVersion?: string): ClientHello => ({
  type: "client_hello",
  protocolVersion: PROTOCOL_VERSION,
  ...(clientVersion ? { clientVersion } : {})
});
