import { Euler, PerspectiveCamera, MathUtils } from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

type LookState = { yaw: number; pitch: number };

/** Three owns mouse rotation; QuizStrike still owns movement, collision, recoil and network aim. */
export class PointerLookController {
  private readonly proxy = new PerspectiveCamera();
  private readonly angles = new Euler(0, 0, 0, "YXZ");
  private readonly controls: PointerLockControls;
  private drag?: { pointerId: number; x: number; y: number };

  constructor(private readonly element: HTMLElement, private readonly options: {
    read: () => LookState;
    write: (state: LookState) => void;
    enabled: () => boolean;
    sensitivity: () => number;
    minPitch: number;
    maxPitch: number;
    dragFallback?: boolean;
  }) {
    // Capture runs before Three's document mouse listener, including immediately after opening a modal.
    element.ownerDocument.addEventListener("mousemove", this.prepare, true);
    this.controls = new PointerLockControls(this.proxy, element);
    // Leave Three's proxy range wider; the gameplay range is clamped after the vertical ratio.
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.addEventListener("change", this.commit);
    if (options.dragFallback) {
      element.addEventListener("pointerdown", this.beginDrag);
      element.ownerDocument.addEventListener("pointermove", this.moveDrag);
      element.ownerDocument.addEventListener("pointerup", this.endDrag);
      element.ownerDocument.addEventListener("pointercancel", this.endDrag);
      element.ownerDocument.defaultView?.addEventListener("blur", this.clearDrag);
    }
  }

  private beginDrag = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !this.options.enabled()
      || this.element.ownerDocument.pointerLockElement === this.element) return;
    this.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    try { this.element.setPointerCapture(event.pointerId); } catch { /* Document tracking remains available. */ }
  };

  private moveDrag = (event: PointerEvent) => {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    if (!this.options.enabled() || !(event.buttons & 1)
      || this.element.ownerDocument.pointerLockElement === this.element) { this.clearDrag(); return; }
    const current = this.options.read();
    const sensitivity = this.options.sensitivity();
    this.options.write({
      yaw: current.yaw - (event.clientX - this.drag.x) * 0.0022 * sensitivity,
      pitch: MathUtils.clamp(current.pitch - (event.clientY - this.drag.y) * 0.0018 * sensitivity, this.options.minPitch, this.options.maxPitch)
    });
    this.drag.x = event.clientX;
    this.drag.y = event.clientY;
  };

  private endDrag = (event: PointerEvent) => { if (event.pointerId === this.drag?.pointerId) this.clearDrag(); };
  private clearDrag = () => { this.drag = undefined; };

  private prepare = () => {
    const current = this.options.read();
    this.proxy.rotation.set(current.pitch, current.yaw, 0, "YXZ");
    this.controls.enabled = this.options.enabled();
    this.controls.pointerSpeed = 1.1 * this.options.sensitivity();
  };

  private commit = () => {
    const current = this.options.read();
    this.angles.setFromQuaternion(this.proxy.quaternion, "YXZ");
    this.options.write({
      // Preserve the existing independent horizontal and vertical sensitivity.
      yaw: current.yaw + Math.atan2(Math.sin(this.angles.y - current.yaw), Math.cos(this.angles.y - current.yaw)),
      pitch: MathUtils.clamp(current.pitch + (this.angles.x - current.pitch) * (0.0018 / 0.0022), this.options.minPitch, this.options.maxPitch)
    });
  };

  dispose() {
    this.clearDrag();
    this.element.removeEventListener?.("pointerdown", this.beginDrag);
    this.element.ownerDocument.removeEventListener("pointermove", this.moveDrag);
    this.element.ownerDocument.removeEventListener("pointerup", this.endDrag);
    this.element.ownerDocument.removeEventListener("pointercancel", this.endDrag);
    this.element.ownerDocument.defaultView?.removeEventListener("blur", this.clearDrag);
    this.element.ownerDocument.removeEventListener("mousemove", this.prepare, true);
    this.controls.removeEventListener("change", this.commit);
    this.controls.dispose();
  }
}
