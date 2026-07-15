export const buildApiUrlCandidates = (...values: Array<string | undefined>) =>
  [...new Set(values.map((value) => value?.trim().replace(/\/$/, "")).filter((value): value is string => Boolean(value)))];

export const fetchFromApiCandidates = async ({
  candidates,
  activeUrl,
  path,
  options,
  fetcher = fetch
}: {
  candidates: string[];
  activeUrl: string;
  path: string;
  options?: RequestInit;
  fetcher?: typeof fetch;
}) => {
  const ordered = [activeUrl, ...candidates.filter((candidate) => candidate !== activeUrl)];
  let lastNetworkError: unknown;
  for (const url of ordered) {
    try {
      return { response: await fetcher(`${url}${path}`, options), url };
    } catch (error) {
      lastNetworkError = error;
    }
  }
  throw lastNetworkError ?? new TypeError("No QuizStrike API endpoint is configured.");
};
