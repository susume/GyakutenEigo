import {
  ARENA_PLAYER_EYE_HEIGHT,
  getArenaGroundHeight,
  getArenaLevelLabel,
  getArenaObjectiveGroundY,
  type ArenaMapId,
  type ArenaBounds,
  type GameSession,
  getCaptureZonesForMap,
  getSearchRetrieveDeliveryZonesForMap,
  getSearchRetrieveItemsForMap,
  getTeamBaseZones
} from "@quizstrike/shared";
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
  teamBaseZones: ReturnType<typeof getTeamBaseZones>;
  captureZones: ReturnType<typeof getCaptureZonesForMap>;
  searchRetrieveItems: ReturnType<typeof getSearchRetrieveItemsForMap>;
  searchRetrieveDeliveryZones: ReturnType<typeof getSearchRetrieveDeliveryZonesForMap>;
  hasMultipleLevels: boolean;
  miniMapLevel: string;
  miniMapPlayer: ArenaMinimapPlayer | null;
  displayedFlagPosition?: { x: number; y?: number; z: number };
  session?: GameSession;
};

export const ArenaMinimap = ({
  arenaMap,
  arenaMapId,
  arenaBounds,
  teamBaseZones,
  captureZones,
  searchRetrieveItems,
  searchRetrieveDeliveryZones,
  hasMultipleLevels,
  miniMapLevel,
  miniMapPlayer,
  displayedFlagPosition,
  session
}: ArenaMinimapProps) => {
  const toMiniMapX = (x: number) => ((x + arenaBounds.limitX) / (arenaBounds.limitX * 2)) * MINIMAP_WIDTH;
  const toMiniMapY = (z: number) => ((z + arenaBounds.limitZ) / (arenaBounds.limitZ * 2)) * MINIMAP_HEIGHT;
  const toMiniMapW = (w: number) => (w / (arenaBounds.limitX * 2)) * MINIMAP_WIDTH;
  const toMiniMapH = (d: number) => (d / (arenaBounds.limitZ * 2)) * MINIMAP_HEIGHT;
  const mapClass = arenaMapId === "iron_junction"
    ? "minimap-iron"
    : arenaMapId === "temple_runoff" ? "minimap-temple" : "minimap-sand";
  const objectiveOpacity = (groundY: number) =>
    !hasMultipleLevels || getArenaLevelLabel(arenaMapId, groundY) === miniMapLevel ? 0.95 : 0.35;
  const captureGroundY = (zone: (typeof captureZones)[number]) =>
    "y" in zone && Number.isFinite(zone.y)
      ? zone.y
      : getArenaGroundHeight(arenaMapId, zone.x, zone.z);
  const itemGroundY = (item: (typeof searchRetrieveItems)[number]) =>
    getArenaObjectiveGroundY(arenaMapId, item, 1.4);
  const deliveryGroundY = (zone: { x: number; z: number; y?: number }) =>
    getArenaObjectiveGroundY(arenaMapId, zone, 0);
  const flagGroundY = displayedFlagPosition
    ? getArenaObjectiveGroundY(arenaMapId, displayedFlagPosition, ARENA_PLAYER_EYE_HEIGHT)
    : undefined;
  return (
    <div className="arena-minimap" aria-label={`${arenaMap.title} minimap`}>
      <div className="minimap-title">Map</div>
      <svg viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`} role="img" aria-label={`${arenaMap.title} route overview`}>
        <title>{arenaMap.title} route overview</title>
        <desc>
          {`${arenaMap.title} minimap. Team bases, objectives, item locations, delivery zones, and the current player are represented with color and shape instead of visible text labels.`}
        </desc>
        <rect x="0" y="0" width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} rx="5" className={mapClass} />

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
        {captureZones.map((zone) => {
          const groundY = captureGroundY(zone);
          return (
            <g key={zone.id} opacity={objectiveOpacity(groundY)}>
              <title>{zone.label}</title>
              <circle cx={toMiniMapX(zone.x)} cy={toMiniMapY(zone.z)} r="2.1" className="minimap-capture" />
            </g>
          );
        })}

        {searchRetrieveItems.map((item) => {
          const groundY = itemGroundY(item);
          return (
            <g key={item.id} opacity={objectiveOpacity(groundY)}>
              <title>{item.label}</title>
              <rect x={toMiniMapX(item.x) - 1.4} y={toMiniMapY(item.z) - 1.4} width="2.8" height="2.8" className="minimap-item" />
            </g>
          );
        })}

        {(["blue", "red"] as const).map((team) => {
          const zone = searchRetrieveDeliveryZones[team];
          const groundY = deliveryGroundY(zone);
          return (
            <g key={`${team}-delivery`} opacity={objectiveOpacity(groundY)}>
              <title>{`${team === "blue" ? "Blue" : "Red"} delivery zone`}</title>
              <circle cx={toMiniMapX(zone.x)} cy={toMiniMapY(zone.z)} r="2.8" className={`minimap-${team}-delivery`} />
            </g>
          );
        })}

        {session?.settings.gameMode === "flag" && session.flag && displayedFlagPosition && flagGroundY !== undefined && (
          <g
            className={`minimap-flag minimap-flag-${session.flag.state}`}
            transform={`translate(${toMiniMapX(displayedFlagPosition.x)} ${toMiniMapY(displayedFlagPosition.z)})`}
            opacity={objectiveOpacity(flagGroundY)}
          >
            <title>{`Red flag: ${session.flag.state}`}</title>
            <circle r="3" />
            <path d="M 0 -4 L 0 4 M 0 -4 L 4 -2 L 0 0" />
          </g>
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
