import { ShoppingBag } from "lucide-react";
import {
  GEAR_ITEMS,
  getPlayerPerks,
  getPlayerWeaponId,
  isWeaponGearId,
  type GameSession,
  type PlayerSession
} from "@quizstrike/shared";
import { getShopShortcutKey } from "../../../shopShortcuts";

const formatMoney = (value: number) => `$${Math.round(value)}`;

const gearSubtitle = (gearId: string) => {
  if (gearId === "shield_vest") return "Adds 70 HP";
  if (gearId === "speed_shoes") return "Adds 30 HP and 30 speed";
  if (gearId === "power_blaster") return "Press C to zoom";
  return "";
};

export default function BuyPanel({
  player,
  session,
  onBuy,
  onBuySnowballs,
  buyingGearId,
  isBuyingSnowballs,
  buyPhaseSeconds
}: {
  player: PlayerSession;
  session: GameSession;
  onBuy: (gearId: string) => void;
  onBuySnowballs: () => void;
  buyingGearId: string | null;
  isBuyingSnowballs: boolean;
  buyPhaseSeconds?: number;
}) {
  const GearGlyph = ({ gearId }: { gearId: string }) => {
    if (gearId === "starter_blaster") return <span className="gear-glyph launcher-starter" aria-hidden="true" />;
    if (gearId === "quick_blaster") return <span className="gear-glyph launcher-quick" aria-hidden="true" />;
    if (gearId === "power_blaster") return <span className="gear-glyph launcher-heavy" aria-hidden="true" />;
    return <ShoppingBag size={18} aria-hidden="true" />;
  };

  const snowballPrice = session.settings.snowballPackPrice;
  const snowballCount = session.settings.snowballsPerPack;
  const isBuyingGear = Boolean(buyingGearId);
  const isZombieMode = session.settings.gameMode === "zombie";
  const isZombieHuman = session.settings.gameMode === "zombie" && player.role !== "zombie";
  const gearLockReason = (cost: number) => {
    if (!player.isAlive) return "Available next round";
    if (player.money < cost) return `Need ${formatMoney(cost - player.money)} more`;
    return "Return to base to buy";
  };
  return (
    <div className="panel buy-panel">
      <div className="panel-title">
        <h2>{buyPhaseSeconds === undefined ? "Choose gear" : `Get ready · ${buyPhaseSeconds}s`}</h2>
        <span className="buy-balance">Balance {formatMoney(player.money)}</span>
      </div>
      <p className="menu-timer-note">{buyPhaseSeconds === undefined
        ? "The round clock keeps running while this menu is open."
        : "Press Q to answer questions before the round starts."}</p>
      <p className="buy-shortcut-help">Press 1–5 to choose quickly · B to close</p>
      <button
        className="gear-row"
        onClick={onBuySnowballs}
        aria-keyshortcuts="1"
        disabled={isZombieHuman || !player.isAlive || player.money < snowballPrice || isBuyingSnowballs || isBuyingGear}
      >
        <kbd className="buy-shortcut-key">1</kbd>
        <GearGlyph gearId="snowballs" />
        <span>
          <strong>{isBuyingSnowballs ? "Adding..." : `${snowballCount} snowballs`}</strong>
          <small className="gear-status">{isZombieHuman ? "Humans only" : player.money < snowballPrice ? `Need ${formatMoney(snowballPrice - player.money)} more` : player.isAlive ? "Ready to choose" : "Available next round"}</small>
        </span>
        <em>{formatMoney(snowballPrice)}</em>
      </button>
      {GEAR_ITEMS.filter((gear) => gear.id !== "starter_blaster").map((gear) => (
        <button
          key={gear.id}
          className="gear-row"
          onClick={() => onBuy(gear.id)}
          aria-keyshortcuts={getShopShortcutKey(gear.id)}
          disabled={(isZombieMode && isWeaponGearId(gear.id)) || !player.isAlive || player.money < gear.cost || isBuyingSnowballs || isBuyingGear}
        >
          <kbd className="buy-shortcut-key">{getShopShortcutKey(gear.id)}</kbd>
          <GearGlyph gearId={gear.id} />
          <span>
            <strong>{buyingGearId === gear.id ? "Adding..." : gear.name}</strong>
            {gearSubtitle(gear.id) && <small className="gear-subtitle">{gearSubtitle(gear.id)}</small>}
            <small className="gear-status">{isZombieMode && isWeaponGearId(gear.id) ? "Default launcher only" : (getPlayerWeaponId(player) === gear.id || getPlayerPerks(player).includes(gear.id)) ? "Equipped" : player.money < gear.cost || !player.isAlive ? gearLockReason(gear.cost) : "Ready to choose"}</small>
          </span>
          <em>{formatMoney(gear.cost)}</em>
        </button>
      ))}
    </div>
  );
}
