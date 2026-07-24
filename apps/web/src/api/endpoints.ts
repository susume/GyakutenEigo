export const buildApiUrlCandidates = (...values: Array<string | undefined>) =>
  [...new Set(values.map((value) => value?.trim().replace(/\/$/, "")).filter((value): value is string => Boolean(value)))];

export class ApiRequestTimeoutError extends Error {
  constructor(public timeoutMs: number) {
    super(`API request timed out after ${timeoutMs}ms.`);
    this.name = "ApiRequestTimeoutError";
  }
}

const fetchWithTimeout = async (
  fetcher: typeof fetch,
  url: string,
  options: RequestInit | undefined,
  timeoutMs: number | undefined
) => {
  if (!timeoutMs) return fetcher(url, options);

  const controller = new AbortController();
  const sourceSignal = options?.signal;
  const forwardAbort = () => controller.abort(sourceSignal?.reason);
  if (sourceSignal?.aborted) forwardAbort();
  else sourceSignal?.addEventListener("abort", forwardAbort, { once: true });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new ApiRequestTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetcher(url, { ...options, signal: controller.signal }),
      timeout
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    sourceSignal?.removeEventListener("abort", forwardAbort);
  }
};

export const fetchFromApiCandidates = async ({
  candidates,
  activeUrl,
  path,
  options,
  attemptTimeoutMs,
  fetcher = fetch
}: {
  candidates: string[];
  activeUrl: string;
  path: string;
  options?: RequestInit;
  attemptTimeoutMs?: number;
  fetcher?: typeof fetch;
}) => {
  const ordered = [activeUrl, ...candidates.filter((candidate) => candidate !== activeUrl)];
  let lastNetworkError: unknown;
  for (const url of ordered) {
    try {
      return {
        response: await fetchWithTimeout(fetcher, `${url}${path}`, options, attemptTimeoutMs),
        url
      };
    } catch (error) {
      lastNetworkError = error;
    }
  }
  throw lastNetworkError ?? new TypeError("No QuizStrike API endpoint is configured.");
};
