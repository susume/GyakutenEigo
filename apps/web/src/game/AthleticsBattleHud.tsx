import type { CSSProperties } from "react";
import { ATHLETICS_BATTLE_CHARGE_MS } from "@quizstrike/shared";
import { Zap, Crosshair, Snowflake, Shield } from "lucide-react";
import { useSiteTranslation } from "../ui/siteTranslation";
import "./athletics-battle.css";
import { getAthleticsBattlePointerSource } from "./AthleticsBattleInput";

export const AthleticsBattleHud = ({ progress, energy, energyCost, stunSeconds, protectionSeconds = 0, studying = false, hunter, disabled, onHold }: {
  progress: number | null;
  energy: number;
  energyCost: number;
  stunSeconds: number;
  protectionSeconds?: number;
  studying?: boolean;
  hunter?: boolean;
  disabled: boolean;
  onHold: (source: string, held: boolean, cancelled?: boolean) => void;
}) => {
  const { t } = useSiteTranslation();
  const charging = progress !== null;
  const low = energy < energyCost;
  const stunned = stunSeconds > 0;
  const chargeSeconds = ATHLETICS_BATTLE_CHARGE_MS / 1000;
  return <>
    <div className={`battle-reticle${charging ? " charging" : ""}${stunned ? " stunned" : ""}`} style={{ "--battle-charge": progress ?? 0 } as CSSProperties} aria-hidden="true"><span /><Crosshair size={26} /></div>
    {stunned && <div className="battle-stun-status"><Snowflake size={22} aria-hidden="true" /><strong role="status">{t("Stunned")}</strong><span role="timer" aria-live="off">{stunSeconds.toFixed(1)}s</span><small>{t("Movement returns automatically")}</small></div>}
    {!stunned && (studying || protectionSeconds > 0) && <>
      <div className="battle-protection-glow" aria-hidden="true" />
      {!studying && <div className="battle-protection-status"><Shield size={20} aria-hidden="true" /><strong role="status">{t("Protected")}</strong><span role="timer" aria-live="off">{Math.ceil(protectionSeconds)}s</span></div>}
    </>}
    <div className={`athletics-battle-hud${charging ? " charging" : ""}`} data-testid="athletics-battle-hud">
      <button type="button" className="battle-charge-button" disabled={disabled || low || stunned} aria-label={t("Hold to charge energy blast")} aria-keyshortcuts="F" aria-describedby="battle-charge-help"
        onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Window-level release also clears this hold. */ } onHold(getAthleticsBattlePointerSource(event.pointerId), true); }}
        onPointerUp={(event) => onHold(getAthleticsBattlePointerSource(event.pointerId), false)} onPointerCancel={(event) => onHold(getAthleticsBattlePointerSource(event.pointerId), false, true)} onLostPointerCapture={(event) => onHold(getAthleticsBattlePointerSource(event.pointerId), false, true)}
        onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onHold("button-key", true); } }}
        onKeyUp={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onHold("button-key", false); } }} onBlur={() => onHold("button-key", false, true)}>
        <Zap size={20} aria-hidden="true" /><span><strong>{stunned ? t("Stunned") : charging ? t("Charging…") : low ? t("Answer for energy") : t("Energy blast")}</strong><small>{charging ? `${(Math.min(1, progress ?? 0) * chargeSeconds).toFixed(1)} / ${chargeSeconds.toFixed(1)}s` : `${energyCost} ${t("energy / blast")}`}</small></span><kbd>F</kbd>
        <span className="battle-charge-meter" role="progressbar" aria-label={t("Blast charge")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)}><i style={{ transform: `scaleX(${progress ?? 0})` }} /></span>
      </button>
      <small id="battle-charge-help">{t("Hold F, left mouse or this button for 2s")}</small>
      <small>{t("Aim ahead · Blasts fly straight")}</small>
      {hunter && <small>{t("G: Throw foam ball")}</small>}
    </div>
  </>;
};
