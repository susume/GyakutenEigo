import { MessageCircle } from "lucide-react";

type GyakutenEigoBrandProps = {
  compact?: boolean;
};

export default function GyakutenEigoBrand({ compact = false }: GyakutenEigoBrandProps) {
  return (
    <span className={`performance-brand${compact ? " performance-brand-compact" : ""}`}>
      <span className="performance-brand-mark">
        <MessageCircle size={compact ? 22 : 25} strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span>GyakutenEigo</span>
    </span>
  );
}
