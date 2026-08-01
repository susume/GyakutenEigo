import { randomUUID } from "node:crypto";
import type { BotDifficulty } from "@quizstrike/shared";

export interface ServerConfig {
  environment: string;
  isProduction: boolean;
  port: number;
  jwtSecret: string;
  databaseUrl?: string;
  configuredOrigins?: string;
  trustProxy: boolean;
  botDifficulty: BotDifficulty;
  networkDebug: boolean;
  networkReportIntervalMs: number;
  autoStart: boolean;
  runtimeStore: "in-memory";
  instanceId: string;
  roomLeaseMs: number;
  roomLeaseRenewMs: number;
  shutdownTimeoutMs: number;
  testRoundPreparationMs?: number;
  testZombieSelectionMs?: number;
}

const integer = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

export const loadServerConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  const environment = env.NODE_ENV ?? "development";
  const isProduction = environment === "production";
  const jwtSecret = env.JWT_SECRET?.trim() || "local-dev-only-change-me";
  const requestedRuntimeStore = env.RUNTIME_STORE?.trim().toLowerCase() || "in-memory";

  if (isProduction && jwtSecret === "local-dev-only-change-me") {
    throw new Error("JWT_SECRET must be set before running QuizStrike online.");
  }
  if (requestedRuntimeStore !== "in-memory") {
    throw new Error(`RUNTIME_STORE=${requestedRuntimeStore} is not available in this build. Use in-memory with sticky room affinity.`);
  }

  const roomLeaseMs = integer(env.ROOM_LEASE_MS, 15_000, 3_000, 120_000);
  const roomLeaseRenewMs = integer(env.ROOM_LEASE_RENEW_MS, 5_000, 1_000, roomLeaseMs - 500);

  return {
    environment,
    isProduction,
    port: integer(env.PORT, 4_000, 1, 65_535),
    jwtSecret,
    ...(env.DATABASE_URL?.trim() ? { databaseUrl: env.DATABASE_URL.trim() } : {}),
    ...(env.CLIENT_ORIGIN?.trim() || env.CORS_ORIGIN?.trim()
      ? { configuredOrigins: env.CLIENT_ORIGIN?.trim() || env.CORS_ORIGIN?.trim() }
      : {}),
    trustProxy: env.TRUST_PROXY === "true",
    botDifficulty: env.BOT_DIFFICULTY === "beginner" || env.BOT_DIFFICULTY === "advanced"
      ? env.BOT_DIFFICULTY
      : "standard",
    networkDebug: env.NETWORK_DEBUG === "true",
    networkReportIntervalMs: integer(env.NETWORK_REPORT_INTERVAL_MS, 60_000, 10_000, 3_600_000),
    autoStart: env.QUIZSTRIKE_NO_AUTOSTART !== "true",
    runtimeStore: "in-memory",
    instanceId: env.INSTANCE_ID?.trim() || randomUUID(),
    roomLeaseMs,
    roomLeaseRenewMs,
    shutdownTimeoutMs: integer(env.SHUTDOWN_TIMEOUT_MS, 10_000, 1_000, 60_000),
    ...(environment === "test" && env.QUIZSTRIKE_TEST_ROUND_PREPARATION_MS
      ? { testRoundPreparationMs: integer(env.QUIZSTRIKE_TEST_ROUND_PREPARATION_MS, 35_000, 10, 60_000) }
      : {}),
    ...(environment === "test" && env.QUIZSTRIKE_TEST_ZOMBIE_SELECTION_MS
      ? { testZombieSelectionMs: integer(env.QUIZSTRIKE_TEST_ZOMBIE_SELECTION_MS, 20_000, 10, 60_000) }
      : {})
  };
};

