import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const browserSnapshot = () => true;
const serverSnapshot = () => false;

// Prerendered controls become interactive after React attaches their handlers.
export function useHydrated() {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}
