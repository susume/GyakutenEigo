import { getArenaLevelLabel, type ArenaMapId, type ArenaBounds, type GameSession } from "@quizstrike/shared";
import type { ArenaMapData } from "./arenaMaps";

export const MINIMAP_WIDTH = 120;
export const MINIMAP_HEIGHT = 110;

export type ArenaMinimapPlayer = {
  x: number;
  z: number;
  y?: number;
  facing: number;
};

type ArenaMinimapProps = {
  arenaMap: ArenaMapData;
  arenaMapId: ArenaMapId;
  arenaBounds: ArenaBounds;
  teamBaseZones: ReturnType<typeof import("@quizstrike/shared").getTeamBaseZones>;
  captureZones: ReturnType<typeof import("@quizstrike/shared").getCaptureZonesForMap>;
  searchRetrieveItems: ReturnType<typeof import("@quizstrike/shared").getSearchRetrieveItemsForMap>;
  isIronJunction: boolean;
  isDesertCitadel: boolean;
  isTempleRunoff: boolean;
  hasMultipleLevels: boolean;
  miniMapLevel: string;
  miniMapPlayer: ArenaMinimapPlayer | null;
  displayedFlagPosition?: { x: number; z: number };
  session?: GameSession;
  scaleArenaValue: (value: number) => number;
};

export const ArenaMinimap = ({
  arenaMap,
  arenaMapId,
  arenaBounds,
  teamBaseZones,
  captureZones,
  searchRetrieveItems,
  isIronJunction,
  isDesertCitadel,
  isTempleRunoff,
  hasMultipleLevels,
  miniMapLevel,
  miniMapPlayer,
  displayedFlagPosition,
  session,
  scaleArenaValue
}: ArenaMinimapProps) => {
  const toMiniMapX = (x: number) => ((x + arenaBounds.limitX) / (arenaBounds.limitX * 2)) * MINIMAP_WIDTH;
  const toMiniMapY = (z: number) => ((z + arenaBounds.limitZ) / (arenaBounds.limitZ * 2)) * MINIMAP_HEIGHT;
  const toMiniMapW = (w: number) => (w / (arenaBounds.limitX * 2)) * MINIMAP_WIDTH;
  const toMiniMapH = (d: number) => (d / (arenaBounds.limitZ * 2)) * MINIMAP_HEIGHT;

  return (
<div className="arena-minimap" aria-label={`${arenaMap.title} minimap`}>
  <div className="minimap-title">Map</div>
  <svg viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`} role="img" aria-label={`${arenaMap.title} route overview`}>
    <rect x="0" y="0" width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} rx="5" className={isIronJunction ? "minimap-iron" : isTempleRunoff ? "minimap-temple" : "minimap-sand"} />
    {arenaMap.floorMarks.slice(0, 5).map((mark) => (
      <rect
        key={mark.id}
        x={toMiniMapX(mark.x - mark.w / 2)}
        y={toMiniMapY(mark.z - mark.d / 2)}
        width={Math.max(1, toMiniMapW(mark.w))}
        height={Math.max(1, toMiniMapH(mark.d))}
        className="minimap-route"
        opacity={!hasMultipleLevels || getArenaLevelLabel(arenaMapId, mark.y ?? 0) === miniMapLevel ? 0.9 : 0.32}
      />
    ))}
    {arenaMap.blocks.filter((block) => block.collides).map((block) => (
      <rect
        key={block.id}
        x={toMiniMapX(block.x - block.w / 2)}
        y={toMiniMapY(block.z - block.d / 2)}
        width={Math.max(0.7, toMiniMapW(block.w))}
        height={Math.max(0.7, toMiniMapH(block.d))}
        className={block.material === "wood" ? "minimap-wood" : "minimap-wall"}
        opacity={!hasMultipleLevels || getArenaLevelLabel(arenaMapId, (block.y ?? block.h / 2) - block.h / 2) === miniMapLevel ? 0.82 : 0.28}
      />
    ))}
    <rect
      x={toMiniMapX(teamBaseZones.blue.minX)}
      y={toMiniMapY(teamBaseZones.blue.minZ)}
      width={toMiniMapW(teamBaseZones.blue.maxX - teamBaseZones.blue.minX)}
      height={toMiniMapH(teamBaseZones.blue.maxZ - teamBaseZones.blue.minZ)}
      className="minimap-blue-base"
    />
    <rect
      x={toMiniMapX(teamBaseZones.red.minX)}
      y={toMiniMapY(teamBaseZones.red.minZ)}
      width={toMiniMapW(teamBaseZones.red.maxX - teamBaseZones.red.minX)}
      height={toMiniMapH(teamBaseZones.red.maxZ - teamBaseZones.red.minZ)}
      className="minimap-red-base"
    />
    {captureZones.map((zone) => (
      <circle key={zone.id} cx={toMiniMapX(zone.x)} cy={toMiniMapY(zone.z)} r="2.1" className="minimap-capture" />
    ))}
    {searchRetrieveItems.map((item) => (
      <rect key={item.id} x={toMiniMapX(item.x) - 1.4} y={toMiniMapY(item.z) - 1.4} width="2.8" height="2.8" className="minimap-item" />
    ))}
    {session?.settings.gameMode === "flag" && session.flag && displayedFlagPosition && (
      <g className={`minimap-flag minimap-flag-${session.flag.state}`} transform={`translate(${toMiniMapX(displayedFlagPosition.x)} ${toMiniMapY(displayedFlagPosition.z)})`}>
        <circle r="3" />
        <path d="M 0 -4 L 0 4 M 0 -4 L 4 -2 L 0 0" />
      </g>
    )}
    {!isDesertCitadel && (
      <>
        <text x={toMiniMapX(isIronJunction ? scaleArenaValue(-248) : scaleArenaValue(-205))} y={toMiniMapY(isIronJunction ? 0 : scaleArenaValue(-154))} className="minimap-label">Blue</text>
        <text x={toMiniMapX(isIronJunction ? scaleArenaValue(232) : scaleArenaValue(184))} y={toMiniMapY(isIronJunction ? 0 : scaleArenaValue(-154))} className="minimap-label">Red</text>
        <text x={toMiniMapX(isIronJunction ? scaleArenaValue(-112) : 0)} y={toMiniMapY(isIronJunction ? scaleArenaValue(-130) : scaleArenaValue(-164))} className="minimap-label">{isIronJunction ? "Warehouse" : "Jungle"}</text>
        <text x={toMiniMapX(isIronJunction ? scaleArenaValue(58) : 0)} y={toMiniMapY(isIronJunction ? scaleArenaValue(-38) : 0)} className="minimap-label">{isIronJunction ? "Control" : "River"}</text>
        <text x={toMiniMapX(isIronJunction ? scaleArenaValue(104) : 0)} y={toMiniMapY(isIronJunction ? scaleArenaValue(151) : scaleArenaValue(156))} className="minimap-label">{isIronJunction ? "Depot" : "Court"}</text>
      </>
    )}
    {isDesertCitadel && [
      [-86, 0], [0, -45], [0, 101], [185, 70], [-181, 76], [84, 81]
    ].map(([x, z]) => (
      <rect
        key={`citadel-stair-${x}-${z}`}
        x={toMiniMapX(scaleArenaValue(x)) - 1.6}
        y={toMiniMapY(scaleArenaValue(z)) - 1.6}
        width="3.2"
        height="3.2"
        rx="0.5"
        className="minimap-stair"
        transform={`rotate(45 ${toMiniMapX(scaleArenaValue(x))} ${toMiniMapY(scaleArenaValue(z))})`}
      />
    ))}
    {isIronJunction && <text x={toMiniMapX(scaleArenaValue(-35))} y={toMiniMapY(scaleArenaValue(218))} className="minimap-label">Tunnel</text>}
    {hasMultipleLevels && !isDesertCitadel && (
      <text x={MINIMAP_WIDTH - 5} y={10} textAnchor="end" className="minimap-label">
        {isTempleRunoff
          ? miniMapLevel === "lower" ? "↓ LOWER" : miniMapLevel === "upper" ? "↑ UPPER" : "• MAIN"
          : isIronJunction
            ? miniMapLevel === "ground" ? "• GROUND" : miniMapLevel === "loading" ? "↑ LOADING" : "↑ OVERPASS"
            : miniMapLevel === "ground" ? "• GROUND" : miniMapLevel === "citadel" ? "↑ CITADEL" : "↑↑ LOOKOUT"}
      </text>
    )}
    {miniMapPlayer && (
      <g
        className="minimap-player"
        transform={`translate(${toMiniMapX(miniMapPlayer.x)} ${toMiniMapY(miniMapPlayer.z)}) rotate(${(-miniMapPlayer.facing * 180) / Math.PI})`}
      >
        <path d="M 0 -5 L 3.5 4 L 0 2 L -3.5 4 Z" />
      </g>
    )}
  </svg>
</div>
  );
};
