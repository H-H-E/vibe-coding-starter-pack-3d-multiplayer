/**
 * CollisionSystem.ts — Collision detection for the flail game.
 *
 * Handles:
 * - Body vs surfaces (landing, sliding)
 * - Head vs surfaces (anchor detection)
 * - Surface type properties (concrete, silt, glass, faraday)
 */

export type SurfaceType = 'concrete' | 'silt' | 'glass' | 'faraday' | 'air';

export interface Surface {
  type: SurfaceType;
  x: number;        // Left edge
  y: number;         // Top edge (Y increases upward in world space)
  width: number;
  height: number;
  breakVelocityThreshold?: number;
  broken?: boolean;
}

export const BODY_WIDTH = 1.2;
export const BODY_HEIGHT = 1.2;
export const ANCHOR_RADIUS = 2.5;

export class CollisionSystem {
  private surfaces: Surface[] = [];

  constructor() {
    this.buildLevel();
  }

  private buildLevel() {
    this.surfaces = [];

    // Ground floor — thick concrete slab from y=-10 to y=-5 (height=5)
    this.surfaces.push({ type: 'concrete', x: -20, y: -10, width: 60, height: 5 });

    // Stepped platforms going up (y increases upward)
    const platforms = [
      { x: -5,   y: -2,   w: 6,   h: 0.5, type: 'concrete' },
      { x: 3,    y: 0,    w: 5,   h: 0.5, type: 'concrete' },
      { x: -8,   y: 2,    w: 5,   h: 0.5, type: 'concrete' },
      { x: 0,    y: 5,    w: 4,   h: 0.5, type: 'concrete' },
      { x: -4,   y: 8,    w: 4,   h: 0.5, type: 'concrete' },
      { x: 2,    y: 11,   w: 5,   h: 0.5, type: 'concrete' },
      // Silt slope — zero friction
      { x: -10,  y: 13,   w: 3,   h: 0.3, type: 'silt' },
      // Glass platform — breaks on hard impact
      { x: -2,   y: 14,   w: 4,   h: 0.3, type: 'glass', breakVel: 12 },
      { x: 1,    y: 17,   w: 5,   h: 0.5, type: 'concrete' },
      // Faraday cage — no anchoring inside
      { x: -6,   y: 16,   w: 3,   h: 6,   type: 'faraday' },
      { x: -3,   y: 21,   w: 6,   h: 0.5, type: 'concrete' },
    ];

    for (const p of platforms) {
      this.surfaces.push({
        type: p.type,
        x: p.x,
        y: p.y,
        width: p.w,
        height: p.h,
        breakVelocityThreshold: (p as any).breakVel,
      });
    }
  }

  /**
   * Resolve body collision with all surfaces.
   * CALL BEFORE integrating position — this corrects the position.
   * Returns the surface the body is resting on (if any).
   */
  resolveBodyCollision(
    bodyX: number,
    bodyY: number,
    bodyVelX: number,
    bodyVelY: number
  ): { surface: Surface | null; grounded: boolean; newX: number; newY: number; newVelX: number; newVelY: number } {
    const bodyLeft = bodyX - BODY_WIDTH / 2;
    const bodyRight = bodyX + BODY_WIDTH / 2;
    const bodyBottom = bodyY - BODY_HEIGHT / 2; // lowest point
    const bodyTop = bodyY + BODY_HEIGHT / 2;   // highest point

    let resolvedX = bodyX;
    let resolvedY = bodyY;
    let resolvedVelX = bodyVelX;
    let resolvedVelY = bodyVelY;
    let grounded = false;
    let floorSurface: Surface | null = null;
    let floorY = -Infinity;

    for (const surf of this.surfaces) {
      if (surf.type === 'air' || surf.broken) continue;

      const surfLeft = surf.x;
      const surfRight = surf.x + surf.width;
      const surfTop = surf.y + surf.height; // top of surface
      const surfBottom = surf.y;            // bottom of surface

      // AABB overlap check
      const overlapsX = bodyRight > surfLeft && bodyLeft < surfRight;
      const overlapsY = bodyTop > surfBottom && bodyBottom < surfTop;

      if (overlapsX && overlapsY) {
        // Collision detected — find smallest penetration to resolve
        const penLeft = bodyRight - surfLeft;   // penetration from left
        const penRight = surfRight - bodyLeft;   // penetration from right
        const penBottom = bodyTop - surfBottom; // penetration from below
        const penTop = surfTop - bodyBottom;    // penetration from above

        const minPen = Math.min(penLeft, penRight, penBottom, penTop);

        if (minPen === penBottom && bodyVelY <= 0) {
          // Landing on top of surface — push up
          resolvedY = surfTop + BODY_HEIGHT / 2;
          resolvedVelY = 0;
          grounded = true;
          if (surfTop > floorY) {
            floorY = surfTop;
            floorSurface = surf;
          }
        } else if (minPen === penTop && bodyVelY > 0) {
          // Hitting bottom of surface — push down
          resolvedY = surfBottom - BODY_HEIGHT / 2;
          resolvedVelY = 0;
        } else if (minPen === penLeft) {
          resolvedX = surfLeft - BODY_WIDTH / 2;
          resolvedVelX = 0;
        } else if (minPen === penRight) {
          resolvedX = surfRight + BODY_WIDTH / 2;
          resolvedVelX = 0;
        }
      }
    }

    return { surface: floorSurface, grounded, newX: resolvedX, newY: resolvedY, newVelX: resolvedVelX, newVelY: resolvedVelY };
  }

  /**
   * Find the nearest surface within anchor radius of a world point.
   */
  findAnchorTarget(headX: number, headY: number, inFaraday: boolean): { hit: boolean; surface: Surface | null; hitX: number; hitY: number } {
    if (inFaraday) return { hit: false, surface: null, hitX: headX, hitY: headY };

    let bestDist = ANCHOR_RADIUS;
    let best: { hit: boolean; surface: Surface | null; hitX: number; hitY: number } | null = null;

    for (const surf of this.surfaces) {
      if (surf.type === 'air' || surf.broken) continue;
      if (surf.type === 'faraday') continue;

      // Find nearest point on surface rectangle to head
      const nearestX = Math.max(surf.x, Math.min(headX, surf.x + surf.width));
      const nearestY = Math.max(surf.y, Math.min(headY, surf.y + surf.height));
      const dx = headX - nearestX;
      const dy = headY - nearestY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        best = { hit: true, surface: surf, hitX: nearestX, hitY: nearestY };
      }
    }

    return best ?? { hit: false, surface: null, hitX: headX, hitY: headY };
  }

  /**
   * Check if a point is inside a Faraday cage.
   */
  isInFaraday(x: number, y: number): boolean {
    for (const surf of this.surfaces) {
      if (surf.type === 'faraday' && !surf.broken) {
        if (x >= surf.x && x <= surf.x + surf.width && y >= surf.y && y <= surf.y + surf.height) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Break a glass surface if impact velocity exceeds threshold.
   */
  tryBreakGlass(surface: Surface, impactVelocity: number): boolean {
    if (surface.type === 'glass' && !surface.broken) {
      const threshold = surface.breakVelocityThreshold ?? 12;
      if (Math.abs(impactVelocity) >= threshold) {
        surface.broken = true;
        return true;
      }
    }
    return false;
  }

  getSurfaces(): Surface[] {
    return this.surfaces;
  }
}
