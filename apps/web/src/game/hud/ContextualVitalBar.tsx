import { useEffect, useSyncExternalStore } from "react";
import { useAnimate } from "motion/react-mini";
import { HeartPulse, Zap } from "lucide-react";
import type { HudManager } from "./HudManager";
import "./contextual-hud.css";

export function ContextualVitalBar({ manager, kind, value, maximum }: {
  manager: HudManager; kind: "health" | "energy"; value: number; maximum: number;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  const visible = kind === "health" ? state.healthVisible : state.energyVisible;
  const label = kind === "health" ? "Health" : "Energy";
  const safeMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : 100;
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(safeMaximum, value)) : 0;
  const fraction = safeValue / safeMaximum;
  const Icon = kind === "health" ? HeartPulse : Zap;

  useEffect(() => {
    if (!scope.current) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const animation = animate(scope.current, { opacity: visible ? 1 : .72 }, { duration: reducedMotion ? 0 : visible ? 0.12 : 0.4 });
    return () => { animation.stop(); };
  }, [visible, animate, scope]);

  return <div ref={scope} className={`hud-stat contextual-vital contextual-vital-${kind}${fraction <= .25 ? " low" : ""}`}
    data-visible={visible} data-combat={state.inCombat}>
    <div className="contextual-vital-heading"><Icon size={18} aria-hidden="true" /><small>{label}</small><strong>{Math.round(safeValue)}<span>/{safeMaximum}</span></strong></div>
    <div className="contextual-vital-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={safeMaximum} aria-valuenow={safeValue}>
      <div className="contextual-vital-fill" style={{ transform: `scaleX(${fraction})` }} />
    </div>
  </div>;
}
