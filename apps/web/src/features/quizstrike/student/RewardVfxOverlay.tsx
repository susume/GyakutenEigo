export type RewardVfxCue = {
  id: number;
  label: string;
  amount?: number;
  kind: "correct" | "purchase";
};

export default function RewardVfxOverlay({
  cue,
  onComplete
}: {
  cue: RewardVfxCue | null;
  onComplete: () => void;
}) {
  if (!cue) return null;

  return (
    <div key={cue.id} className={`reward-vfx-overlay reward-vfx-${cue.kind}`} aria-hidden="true">
      <span className="reward-vfx-burst" />
      <span className="reward-vfx-label">{cue.label}</span>
      <span className="reward-vfx-trail">
        <i />
        <i />
        <i />
      </span>
      <span className="reward-vfx-fly-token" onAnimationEnd={onComplete}>
        {cue.amount ? `+$${cue.amount}` : "✓"}
      </span>
    </div>
  );
}
