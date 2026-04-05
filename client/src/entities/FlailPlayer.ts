/**
 * FlailPlayer.ts — The player's flail entity.
 *
 * Owns: Body, WiggleChain, CollisionSystem, InputSystem.
 * Runs physics each frame, handles anchor mechanic.
 */

import { Body } from '../physics/Body';
import { WiggleChain } from '../physics/WiggleChain';
import { CollisionSystem } from '../physics/CollisionSystem';
import { InputSystem } from '../systems/InputSystem';

export interface FlailPlayerState {
  bodyX: number;
  bodyY: number;
  bodyVelX: number;
  bodyVelY: number;
  headX: number;
  headY: number;
  chainTension: number;
  isAnchored: boolean;
  grounded: boolean;
  surfaceType: string | null;
}

export class FlailPlayer {
  readonly body: Body;
  readonly chain: WiggleChain;
  readonly collision: CollisionSystem;
  readonly input: InputSystem;

  private anchoredSurfaceType: string | null = null;

  // For camera follow
  cameraTargetX: number = 0;
  cameraTargetY: number = 5;

  constructor(startX: number = 0, startY: number = 2) {
    this.body = new Body({ mass: 1000, gravity: 25, friction: 0.8, positionX: startX, positionY: startY });
    this.chain = new WiggleChain(this.body, {
      segmentCount: 10,
      restLength: 0.8,
      stiffness: 800,
      damping: 0.15,
      chainStartX: startX,
      chainStartY: startY + 0.3,
    });
    this.collision = new CollisionSystem();
    this.input = new InputSystem();

    // Initialize head near body
    const head = this.chain.getHead();
    if (head) {
      head.positionX = startX + 2;
      head.positionY = startY + 2;
      this.chain.setMouse(startX + 2, startY + 2);
    }
  }

  /**
   * Attach input listeners to a canvas.
   */
  attachInput(canvas: HTMLCanvasElement) {
    this.input.attach(canvas);
  }

  detachInput() {
    this.input.detach();
  }

  /**
   * Main update loop — call every frame.
   * @param dt Delta time in seconds
   */
  update(dt: number) {
    this.input.update();

    const mouse = this.input.mouse;
    const head = this.chain.getHead();

    // Update mouse world position (needs camera context — called externally)
    // Check if body is in a Faraday cage
    const inFaraday = this.collision.isInFaraday(this.body.positionX, this.body.positionY);

    // Handle anchor mechanic
    if (mouse.leftJustPressed && head && !this.chain.isHeadAnchored()) {
      // Find nearest anchor point
      const result = this.collision.findAnchorTarget(head.positionX, head.positionY, inFaraday);
      if (result.hit && result.surface) {
        this.chain.anchorHead(result.hitX, result.hitY);
        this.anchoredSurfaceType = result.surface.type;
      }
    }

    if (mouse.leftJustReleased && this.chain.isHeadAnchored()) {
      this.chain.releaseHead();
      this.anchoredSurfaceType = null;
    }

    // Update chain physics
    this.chain.update(this.body, dt);

    // Get reaction force from chain on body
    const chainForce = this.chain.getForceOnBody();

    // Update body physics
    this.body.update(dt, chainForce.x, chainForce.y);

    // Check body-surface collisions
    const col = this.collision.checkBodyCollision(this.body.positionX, this.body.positionY);
    if (col.grounded && col.surface) {
      const surfaceTop = col.surface.y;
      const bodyBottom = this.body.positionY - this.body.BODY_HEIGHT / 2;

      if (bodyBottom < surfaceTop + 0.1) {
        this.body.positionY = surfaceTop + this.body.BODY_HEIGHT / 2;
        const vel = Math.abs(this.body.velocityY);

        if (vel > 5) {
          // Try to break glass
          this.collision.tryBreakGlass(col.surface, vel);
        }

        this.body.velocityY = 0;
        this.body.grounded = true;

        // Surface friction
        if (col.surface.type === 'silt') {
          this.body.friction = 0.0; // Zero friction — will slide
        } else {
          this.body.friction = 0.85;
        }

        // Snap body Y to surface
        this.body.positionY = surfaceTop + this.body.BODY_HEIGHT / 2;
      }
    }

    // Update camera target — keep body in lower 1/3 of view
    this.cameraTargetX = this.body.positionX;
    this.cameraTargetY = this.body.positionY + 3; // Keep body lower

    // Keep head synced to input mouse
    if (head && !this.chain.isHeadAnchored()) {
      this.chain.setMouse(mouse.worldX, mouse.worldY);
    }
  }

  /**
   * Get current state for rendering.
   */
  getState(): FlailPlayerState {
    const head = this.chain.getHead();
    return {
      bodyX: this.body.positionX,
      bodyY: this.body.positionY,
      bodyVelX: this.body.velocityX,
      bodyVelY: this.body.velocityY,
      headX: head?.positionX ?? 0,
      headY: head?.positionY ?? 0,
      chainTension: this.chain.getTotalTension(),
      isAnchored: this.chain.isHeadAnchored(),
      grounded: this.body.grounded,
      surfaceType: this.anchoredSurfaceType,
    };
  }

  getSurfaces() {
    return this.collision.getSurfaces();
  }
}
