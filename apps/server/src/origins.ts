const DEFAULT_PRODUCTION_WEB_ORIGINS = [
  "https://gyakuteneigo.com",
  "https://www.gyakuteneigo.com",
  "https://susume.github.io"
] as const;

const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, "");

export const resolveClientOrigins = ({
  configuredOrigins,
  isProduction
}: {
  configuredOrigins?: string;
  isProduction: boolean;
}) => {
  const configured = (configuredOrigins ?? "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
  const defaults = isProduction ? DEFAULT_PRODUCTION_WEB_ORIGINS : [];
  return [...new Set([...configured, ...defaults])];
};
