export default function ArenaLoading({ label = "Loading the game" }: { label?: string }) {
  return (
    <div className="arena-frame arena-loading" role="status" aria-live="polite">
      <div className="arena-canvas">
        <strong>{label}</strong>
        <span>Getting the game ready...</span>
      </div>
    </div>
  );
}
