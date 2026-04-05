/**
 * WiggleChain.ts — The full flail chain.
 *
 * Manages N spring-mass segments connecting the heavy Body
 * to the Flail Head. The head is magnetically attracted to the mouse.
 */

import { Body } from './Body';
import { WiggleBone } from './WiggleBone';

export interface WiggleChainConfig {
  segmentCount: number;  // Number of spring segments
  restLength: number;    // Natural length of each segment
  stiffness: number;     // Spring stiffness
  damping: number;       // Damping coefficient
  chainStartX: number;   // Where chain attaches to body
  chainStartY: number;   // Where chain attaches to body
}

export class WiggleChain {
  readonly segments: WiggleBone[] = [];
  readonly segmentCount: number;
  readonly restLength: number;
  readonly stiffness: number;
  readonly damping: number;

  // Mouse target (world coords)
  mouseX: number = 0;
  mouseY: number = 0;
  mouseActive: boolean = false;

  constructor(body: Body, config: Partial<WiggleChainConfig> = {}) {
    this.segmentCount = config.segmentCount ?? 10;
    this.restLength = config.restLength ?? 0.8;
    this.stiffness = config.stiffness ?? 800;
    this.damping = config.damping ?? 0.15;

    // Create chain segments from body outward
    for (let i = 0; i < this.segmentCount; i++) {
      const x = (config.chainStartX ?? body.positionX) + i * this.restLength * 0.5;
      const y = (config.chainStartY ?? body.positionY) + 0.5;
      const anchorX = i === 0 ? body.positionX : x - this.restLength;
      const anchorY = i === 0 ? body.positionY : y;

      const seg = new WiggleBone(x, y, anchorX, anchorY, {
        stiffness: this.stiffness,
        damping: this.damping,
        restLength: this.restLength,
        mass: 1,
      });
      this.segments.push(seg);
    }
  }

  /**
   * Set mouse attraction target.
   */
  setMouse(worldX: number, worldY: number) {
    this.mouseX = worldX;
    this.mouseY = worldY;
    this.mouseActive = true;
  }

  /**
   * Clear mouse attraction (releases head from mouse influence).
   */
  clearMouse() {
    this.mouseActive = false;
  }

  /**
   * Anchor the head segment to a world position.
   */
  anchorHead(worldX: number, worldY: number) {
    const head = this.segments[this.segments.length - 1];
    if (head) {
      head.lockTo(worldX, worldY);
    }
  }

  /**
   * Release the head anchor.
   */
  releaseHead() {
    const head = this.segments[this.segments.length - 1];
    if (head) {
      head.release();
    }
  }

  /**
   * Is the head currently anchored?
   */
  isHeadAnchored(): boolean {
    const head = this.segments[this.segments.length - 1];
    return head ? head.anchored : false;
  }

  /**
   * Get the head segment (last in chain).
   */
  getHead(): WiggleBone | undefined {
    return this.segments[this.segments.length - 1];
  }

  /**
   * Get total chain tension (sum across all segments).
   * Used for audio/visual feedback.
   */
  getTotalTension(): number {
    return this.segments.reduce((sum, seg) => sum + seg.getTension(), 0);
  }

  /**
   * Get the force that the chain exerts on the body.
   * This is the reaction force from all segments pulling on the body anchor.
   */
  getForceOnBody(): { x: number; y: number } {
    if (this.segments.length === 0) return { x: 0, y: 0 };

    const seg0 = this.segments[0];
    // Force on body is the opposite of what the first segment's spring pulls
    // F = stiffness * stretch * direction (away from anchor)
    const dx = seg0.positionX - seg0.anchorX;
    const dy = seg0.positionY - seg0.anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const stretch = dist - this.restLength;
    const tensionForce = this.stiffness * Math.max(0, stretch);

    return {
      x: (dx / dist) * tensionForce,
      y: (dy / dist) * tensionForce,
    };
  }

  /**
   * Update all segments and sync anchors.
   * @param body The body this chain is attached to
   * @param dt Delta time in seconds
   */
  update(body: Body, dt: number) {
    // Sync anchor of segment 0 to body
    const seg0 = this.segments[0];
    if (seg0) {
      seg0.setAnchor(body.positionX, body.positionY);
    }

    // Update each segment
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const isHead = i === this.segments.length - 1;
      const prevSeg = i > 0 ? this.segments[i - 1] : null;

      // Set anchor to previous segment
      if (prevSeg) {
        seg.setAnchor(prevSeg.positionX, prevSeg.positionY);
      }

      // Mouse influence only on head
      if (isHead && this.mouseActive && !seg.anchored) {
        seg.update(dt, this.mouseX, this.mouseY, 1.0);
      } else {
        seg.update(dt);
      }
    }
  }

  /**
   * Get all segment positions as arrays for rendering.
   */
  getPositions(): { xs: number[]; ys: number[] } {
    const xs: number[] = this.segments.map(s => s.positionX);
    const ys: number[] = this.segments.map(s => s.positionY);
    return { xs, ys };
  }
}
