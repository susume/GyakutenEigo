export type SpeakingRateLimitWindow = { startedAtMs: number; count: number };

export type SpeakingRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

/** Small, deterministic sliding-window bucket used for early Speaking admission. */
export const consumeSpeakingRateLimit = (
  windows: Map<string, SpeakingRateLimitWindow>,
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now()
): SpeakingRateLimitDecision => {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindowMs = Math.max(1_000, Math.floor(windowMs));
  const current = windows.get(key);
  if (!current || nowMs - current.startedAtMs >= safeWindowMs) {
    windows.set(key, { startedAtMs: nowMs, count: 1 });
    return { allowed: true, retryAfterSeconds: 0, remaining: safeLimit - 1 };
  }
  if (current.count >= safeLimit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((safeWindowMs - Math.max(0, nowMs - current.startedAtMs)) / 1_000)),
      remaining: 0
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0, remaining: safeLimit - current.count };
};
