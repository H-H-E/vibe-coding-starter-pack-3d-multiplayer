/**
 * FlailPlayer.ts — The player's flail entity.
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
    this.body = new Body({ mass: 1000, gravity: 25, friction: 0.85, positionX: startX, positionY: startY });
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

    // Initialize chain head near body
    const head = this.chain.getHead();
    if (head) {
      head.positionX = startX + 1.5;
      head.positionY = startY + 1.0;
      this.chain.setMouse(startX + 1.5, startY + 1.0);
    }
  }

  attachInput(canvas: HTMLCanvasElement) {
    this.input.attach(canvas);
  }

  detachInput() {
    this.input.detach();
  }

  update(dt: number) {
    this.input.update();

    // ── 1. Chain physics ────────────────────────────────────────
    const inFaraday = this.collision.isInFaraday(this.body.positionX, this.body.positionY);

    // Anchor mechanic — left click to lock head
    const mouse = this.input.mouse;
    const head = this.chain.getHead();

    if (mouse.leftJustPressed && head && !this.chain.isHeadAnchored()) {
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

    // ── 2. Apply forces to body ──────────────────────────────────
    this.body.applyForce(chainForce.x, chainForce.y);
    // Gravity is already in body.update(), so we just integrate here
    this.body.velocityX += (-this.body.gravity * this.body.mass / this.body.mass) * 0; // gravity handled in body.update

    // ── 3. Integrate body velocity → position ────────────────────
    this.body.update(dt, chainForce.x, chainForce.y);

    // ── 4. Resolve collision BEFORE final position is set ────────
    const col = this.collision.resolveBodyCollision(
      this.body.positionX,
      this.body.positionY,
      this.body.velocityX,
      this.body.velocityY
    );

    this.body.positionX = col.newX;
    this.body.positionY = col.newY;
    this.body.velocityX = col.newVelX;
    this.body.velocityY = col.newVelY;
    this.body.grounded = col.grounded;

    // Surface friction
    if (col.grounded && col.surface) {
      if (col.surface.type === 'silt') {
        this.body.friction = 0.0;
      } else {
        this.body.friction = 0.85;
      }

      // Try to break glass on landing
      if (col.surface.type === 'glass') {
        this.collision.tryBreakGlass(col.surface, this.body.velocityY);
      }
    }

    // ── 5. Update mouse attraction ───────────────────────────────
    if (head && !this.chain.isHeadAnchored()) {
      this.chain.setMouse(mouse.worldX, mouse.worldY);
    }

    // ── 6. Camera target ─────────────────────────────────────────
    this.cameraTargetX = this.body.positionX;
    this.cameraTargetY = this.body.positionY + 4;
  }

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
      surfaceType: this.anchoredSurfaceType ?? (this.body.grounded ? 'concrete' : null),
    };
  }

  getSurfaces() {
    return this.collision.getSurfaces();
  }
}
