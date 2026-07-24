type RetryOnceOptions<T> = {
  request: (attempt: 0 | 1) => Promise<T>;
  shouldRetry: (error: unknown) => boolean;
  onRetry?: () => void;
  delayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
};

const defaultSleep = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

/** Runs one controlled retry for failures explicitly classified as temporary. */
export async function retryOnce<T>({
  request,
  shouldRetry,
  onRetry,
  delayMs = 0,
  sleep = defaultSleep
}: RetryOnceOptions<T>) {
  try {
    return await request(0);
  } catch (error) {
    if (!shouldRetry(error)) throw error;
    onRetry?.();
    if (delayMs > 0) await sleep(delayMs);
    return request(1);
  }
}
