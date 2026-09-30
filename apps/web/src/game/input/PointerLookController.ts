import { Euler, PerspectiveCamera, MathUtils } from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

type LookState = { yaw: number; pitch: number };

/** Three owns mouse rotation; QuizStrike still owns movement, collision, recoil and network aim. */
export class PointerLookController {
  private readonly proxy = new PerspectiveCamera();
  private readonly angles = new Euler(0, 0, 0, "YXZ");
  private readonly controls: PointerLockControls;

  constructor(private readonly element: HTMLElement, private readonly options: {
    read: () => LookState;
    write: (state: LookState) => void;
    enabled: () => boolean;
    sensitivity: () => number;
    minPitch: number;
    maxPitch: number;
  }) {
    // Capture runs before Three's document mouse listener, including immediately after opening a modal.
    element.ownerDocument.addEventListener("mousemove", this.prepare, true);
    this.controls = new PointerLockControls(this.proxy, element);
    // Leave Three's proxy range wider; the gameplay range is clamped after the vertical ratio.
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.addEventListener("change", this.commit);
  }

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
    this.element.ownerDocument.removeEventListener("mousemove", this.prepare, true);
    this.controls.removeEventListener("change", this.commit);
    this.controls.dispose();
  }
}
