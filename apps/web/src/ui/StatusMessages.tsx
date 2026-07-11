type StatusMessagesProps = {
  error?: string;
  message?: string;
};

/** Shared, accessible feedback for asynchronous actions across teacher and student flows. */
export function StatusMessages({ error, message }: StatusMessagesProps) {
  return (
    <>
      {error && <p className="error-text" role="alert">{error}</p>}
      {message && <p className="success-text" role="status">{message}</p>}
    </>
  );
}
