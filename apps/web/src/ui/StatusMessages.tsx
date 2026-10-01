import { useSiteTranslation } from "./siteTranslation";
type StatusMessagesProps = {
  error?: string;
  message?: string;
};

/** Shared, accessible feedback for asynchronous actions across teacher and student flows. */
export function StatusMessages({ error, message }: StatusMessagesProps) {
  const { t } = useSiteTranslation();
  return (
    <>
      {error && <p className="error-text" role="alert">{t(error)}</p>}
      {message && <p className="success-text" role="status">{t(message)}</p>}
    </>
  );
}
