export default function ArenaLoading({ label = "Loading arena" }: { label?: string }) {
  return (
    <div className="arena-frame arena-loading" role="status" aria-live="polite">
      <div className="arena-canvas">
        <strong>{label}</strong>
        <span>Preparing the fast web player...</span>
      </div>
    </div>
  );
}
