import {
  getArenaBounds,
  getCaptureZonesForMap,
  getSearchRetrieveDeliveryZonesForMap,
  getSearchRetrieveItemsForMap,
  getTeamBaseZones,
  type SessionMapId
} from "@quizstrike/shared";
import { getArenaMap } from "./arenaMaps";

export const loadArenaMapContext = (arenaMapId: SessionMapId) => {
  const arenaMap = getArenaMap(arenaMapId);
  return {
    arenaMap,
    arenaBounds: getArenaBounds(arenaMapId),
    teamBaseZones: getTeamBaseZones(arenaMapId),
    captureZones: getCaptureZonesForMap(arenaMapId),
    searchRetrieveItems: getSearchRetrieveItemsForMap(arenaMapId),
    searchRetrieveDeliveryZones: getSearchRetrieveDeliveryZonesForMap(arenaMapId),
    isIronJunction: arenaMapId === "iron_junction",
    isDesertCitadel: arenaMapId === "desert_citadel",
    isTempleRunoff: arenaMapId === "temple_runoff",
    hasMultipleLevels: arenaMapId === "iron_junction" || arenaMapId === "desert_citadel" || arenaMapId === "temple_runoff"
  };
};
