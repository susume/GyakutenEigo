export class CharacterAudio {
  private footstepPhase = 0;

  update(speed: number, delta: number) {
    if (speed < 0.4) {
      this.footstepPhase = 0;
      return false;
    }
    this.footstepPhase += speed * delta * 0.75;
    if (this.footstepPhase >= 1) {
      this.footstepPhase %= 1;
      return true;
    }
    return false;
  }
}
