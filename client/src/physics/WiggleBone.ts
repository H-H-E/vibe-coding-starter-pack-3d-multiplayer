/**
 * WiggleBone.ts — Single spring-mass segment in the chain.
 *
 * Each segment is attracted to:
 *   - Its anchor point (previous segment, or body for segment 0)
 *   - The mouse cursor (head segment only)
 *
 * Springs follow Hooke's law with damping.
 */

export interface WiggleBoneConfig {
  stiffness: number;   // Spring stiffness (higher = snappier)
  damping: number;      // Velocity damping (lower = more oscillation)
  restLength: number;   // Natural length of spring
  mass: number;         // Segment mass
}

export class WiggleBone {
  positionX: number;
  positionY: number;
  velocityX: number = 0;
  velocityY: number = 0;

  readonly stiffness: number;
  readonly damping: number;
  readonly restLength: number;
  readonly mass: number;

  // Anchor target (world coords) — what this segment is pulled toward
  anchorX: number;
  anchorY: number;

  // Is this segment frozen (anchored)?
  anchored: boolean = false;
  anchoredWorldX: number = 0;
  anchoredWorldY: number = 0;

  constructor(x: number, y: number, anchorX: number, anchorY: number, config: Partial<WiggleBoneConfig> = {}) {
    this.positionX = x;
    this.positionY = y;
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    this.stiffness = config.stiffness ?? 800;
    this.damping = config.damping ?? 0.2;
    this.restLength = config.restLength ?? 1.0;
    this.mass = config.mass ?? 1;
  }

  /**
   * Set the anchor point (the thing this segment connects to).
   * For segment 0, this is the body. For others, it's the previous segment.
   */
  setAnchor(x: number, y: number) {
    this.anchorX = x;
    this.anchorY = y;
  }

  /**
   * Lock this segment to a world position (anchor mechanic).
   */
  lockTo(worldX: number, worldY: number) {
    this.anchored = true;
    this.anchoredWorldX = worldX;
    this.anchoredWorldY = worldY;
    this.positionX = worldX;
    this.positionY = worldY;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  /**
   * Release the anchor lock.
   */
  release() {
    this.anchored = false;
  }

  /**
   * Update spring physics.
   * @param dt Delta time in seconds
   * @param mouseX Mouse world X (for head segment attraction)
   * @param mouseY Mouse world Y (for head segment attraction)
   * @param mouseInfluence How strongly the mouse attracts this segment (0 = none)
   */
  update(dt: number, mouseX?: number, mouseY?: number, mouseInfluence: number = 0) {
    if (this.anchored) {
      this.positionX = this.anchoredWorldX;
      this.positionY = this.anchoredWorldY;
      this.velocityX = 0;
      this.velocityY = 0;
      return;
    }

    // Vector from anchor to this segment
    const dx = this.positionX - this.anchorX;
    const dy = this.positionY - this.anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

    // Spring force: F = -k * (dist - restLength) * direction
    const stretch = dist - this.restLength;
    let forceX = -this.stiffness * stretch * (dx / dist);
    let forceY = -this.stiffness * stretch * (dy / dist);

    // Damping: F = -c * velocity
    forceX += -this.damping * this.velocityX;
    forceY += -this.damping * this.velocityY;

    // Mouse attraction (only for head segment)
    if (mouseInfluence > 0 && mouseX !== undefined && mouseY !== undefined) {
      const mdx = mouseX - this.positionX;
      const mdy = mouseY - this.positionY;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy) || 0.0001;
      const mouseForce = mouseInfluence * 300;
      forceX += (mdx / mDist) * mouseForce;
      forceY += (mdy / mDist) * mouseForce;
    }

    // RK4-like integration for stability
    // For simplicity, using semi-implicit Euler with small dt clamping
    const clampedDt = Math.min(dt, 1 / 30); // Cap at 30fps equivalent for stability

    this.velocityX += (forceX / this.mass) * clampedDt;
    this.velocityY += (forceY / this.mass) * clampedDt;

    // Clamp velocity to prevent explosion
    const maxVel = 80;
    const vel = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
    if (vel > maxVel) {
      this.velocityX = (this.velocityX / vel) * maxVel;
      this.velocityY = (this.velocityY / vel) * maxVel;
    }

    this.positionX += this.velocityX * clampedDt;
    this.positionY += this.velocityY * clampedDt;
  }

  /**
   * Get the tension in the spring (0 = rest, positive = stretched).
   * Used for audio + visual feedback.
   */
  getTension(): number {
    const dx = this.positionX - this.anchorX;
    const dy = this.positionY - this.anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, dist - this.restLength);
  }
}
