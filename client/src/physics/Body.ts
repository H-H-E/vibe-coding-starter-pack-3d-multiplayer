/**
 * Body.ts — The heavy root node of the flail.
 * High mass, subject to gravity and chain spring forces.
 */

export interface BodyConfig {
  mass: number;
  gravity: number;
  positionX: number;
  positionY: number;
  friction: number; // 0-1, affects sliding on surfaces
}

export class Body {
  positionX: number;
  positionY: number;
  velocityX: number = 0;
  velocityY: number = 0;
  readonly mass: number;
  readonly gravity: number;
  friction: number;
  grounded: boolean = false;

  constructor(config: Partial<BodyConfig> = {}) {
    this.mass = config.mass ?? 1000;
    this.gravity = config.gravity ?? 25;
    this.positionX = config.positionX ?? 0;
    this.positionY = config.positionY ?? 2;
    this.friction = config.friction ?? 0.8;
  }

  /**
   * Apply a force (in world units) to the body.
   * Force is divided by mass to get acceleration.
   */
  applyForce(forceX: number, forceY: number) {
    this.velocityX += (forceX / this.mass);
    this.velocityY += (forceY / this.mass);
  }

  /**
   * Apply an impulse (instant velocity change).
   */
  applyImpulse(impulseX: number, impulseY: number) {
    this.velocityX += impulseX / this.mass;
    this.velocityY += impulseY / this.mass;
  }

  /**
   * Integrate velocity + position, apply gravity.
   * @param dt Delta time in seconds
   * @param chainForceX Chain reaction force pulling the body
   * @param chainForceY Chain reaction force pulling the body
   */
  update(dt: number, chainForceX: number = 0, chainForceY: number = 0) {
    // Gravity
    const gravityForce = -this.gravity * this.mass;
    const totalForceX = chainForceX;
    const totalForceY = gravityForce + chainForceY;

    // Integrate acceleration
    this.velocityX += (totalForceX / this.mass) * dt;
    this.velocityY += (totalForceY / this.mass) * dt;

    // Friction when grounded
    if (this.grounded) {
      this.velocityX *= Math.pow(this.friction, dt * 60);
    }

    // Clamp velocity to prevent explosion
    const maxVel = 100;
    this.velocityX = Math.max(-maxVel, Math.min(maxVel, this.velocityX));
    this.velocityY = Math.max(-maxVel, Math.min(maxVel, this.velocityY));

    // Integrate position
    this.positionX += this.velocityX * dt;
    this.positionY += this.velocityY * dt;

    this.grounded = false;
  }

  /**
   * Call when body hits a surface at given Y.
   */
  land(surfaceY: number, bounceCoeff: number = 0.1) {
    if (this.positionY > surfaceY) {
      this.positionY = surfaceY;
      this.velocityY = -this.velocityY * bounceCoeff;
      if (Math.abs(this.velocityY) < 0.5) this.velocityY = 0;
      this.grounded = true;
    }
  }
}
