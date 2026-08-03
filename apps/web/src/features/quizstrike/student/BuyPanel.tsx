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
    if (!player.isAlive) return "Round only";
    if (player.money < cost) return `Need ${formatMoney(cost - player.money)}`;
    return "Base required";
  };
  return (
    <div className="panel buy-panel">
      <div className="panel-title">
        <h2>{buyPhaseSeconds === undefined ? "Buy Menu" : `Preparation · ${buyPhaseSeconds}s`}</h2>
        <span>{formatMoney(player.money)}</span>
      </div>
      <p className="menu-timer-note">{buyPhaseSeconds === undefined
        ? "The round timer continues while this menu is open."
        : "Press Q to answer questions for more money before the round starts."}</p>
      <p className="buy-shortcut-help">Press 1–5 to buy instantly. Press B to open or close this menu.</p>
      <button
        className="gear-row"
        onClick={onBuySnowballs}
        aria-keyshortcuts="1"
        disabled={isZombieHuman || !player.isAlive || player.money < snowballPrice || isBuyingSnowballs || isBuyingGear}
      >
        <kbd className="buy-shortcut-key">1</kbd>
        <GearGlyph gearId="snowballs" />
        <span>
          <strong>{isBuyingSnowballs ? "Working..." : `${snowballCount} Snowballs`}</strong>
          <small>Restock ammunition anywhere on the map.</small>
          <small className="gear-status">{isZombieHuman ? "Zombies only" : player.money < snowballPrice ? `Need ${formatMoney(snowballPrice - player.money)} more` : player.isAlive ? "Ready to buy" : "Available next round"}</small>
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
            <strong>{buyingGearId === gear.id ? "Working..." : gear.name}</strong>
            <small>{gear.description}</small>
            <small className="gear-status">{isZombieMode && isWeaponGearId(gear.id) ? "Default launcher only" : (getPlayerWeaponId(player) === gear.id || getPlayerPerks(player).includes(gear.id)) ? "Equipped" : player.money < gear.cost || !player.isAlive ? gearLockReason(gear.cost) : "Ready to buy"}</small>
          </span>
          <em>{formatMoney(gear.cost)}</em>
        </button>
      ))}
    </div>
  );
}
