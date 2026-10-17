import { ATHLETICS_BATTLE_CHARGE_MS, type AthleticsBattleAction } from "@quizstrike/shared";

export const getAthleticsBattlePointerSource = (pointerId: number) => `pointer:${pointerId}`;

/** One charge per press, shared by keyboard, mouse, touch and controller. */
export class AthleticsBattleInput {
  private held = new Set<string>();
  private chargeId: string | undefined;
  private startedAt: number | undefined;
  private latched = false;
  private generation = 0;
  constructor(private options: {
    canCharge: () => boolean;
    send: (action: AthleticsBattleAction, chargeId: string) => Promise<boolean>;
    progress: (value: number | null) => void;
    charging: (active: boolean) => void;
    now?: () => number;
    id?: () => string;
  }) {}
  get progress() {
    return this.startedAt === undefined ? null : Math.min(1, (this.now() - this.startedAt) / ATHLETICS_BATTLE_CHARGE_MS);
  }
  private now() { return this.options.now?.() ?? performance.now(); }
  setHeld(source: string, pressed: boolean, cancelled = false) {
    if (!pressed) {
      if (!this.held.delete(source)) return;
      if (!this.held.size) {
        // Input events can arrive before the next animation frame. A completed
        // hold must still fire when the student releases at the three-second mark.
        if (!cancelled) this.update();
        this.cancel();
        this.latched = false;
      }
      return;
    }
    if (this.held.has(source)) return;
    this.held.add(source);
    if (this.latched || this.chargeId || !this.options.canCharge()) return;
    this.latched = true;
    const chargeId = this.options.id?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const generation = ++this.generation;
    this.chargeId = chargeId;
    this.options.progress(0);
    void this.options.send("battle_charge", chargeId).then((ok) => {
      if (generation !== this.generation) return;
      if (!ok || !this.held.size || !this.options.canCharge()) { this.cancel(); return; }
      // Start after the server acknowledges. Network delay cannot make firing early.
      this.startedAt = this.now();
      this.options.charging(true);
    }).catch(() => { if (generation === this.generation) this.cancel(); });
  }
  update() {
    if (!this.chargeId) return;
    if (!this.options.canCharge()) { this.cancel(); return; }
    const progress = this.progress;
    if (progress === null) return;
    this.options.progress(progress);
    if (progress < 1) return;
    const chargeId = this.chargeId;
    this.chargeId = undefined;
    this.startedAt = undefined;
    this.generation++;
    this.options.charging(false);
    this.options.progress(null);
    void this.options.send("battle_fire", chargeId).catch(() => undefined);
  }
  cancel() {
    const chargeId = this.chargeId;
    this.chargeId = undefined;
    this.startedAt = undefined;
    this.generation++;
    this.options.charging(false);
    this.options.progress(null);
    if (chargeId) void this.options.send("battle_cancel", chargeId).catch(() => undefined);
  }
  reset() {
    this.held.clear();
    this.latched = false;
    this.cancel();
  }
}
