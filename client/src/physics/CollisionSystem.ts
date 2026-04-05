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
  y: number;         // Top edge (higher Y = lower on screen in 2D)
  width: number;
  height: number;
  breakVelocityThreshold?: number; // For shatter-glass
  broken?: boolean;
}

export interface CollisionResult {
  hit: boolean;
  surface: Surface | null;
  hitX: number;
  hitY: number;
  normalX: number;
  normalY: number;
}

/**
 * Simple AABB collision check.
 */
function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export class CollisionSystem {
  private surfaces: Surface[] = [];
  readonly ANCHOR_RADIUS = 2.5; // World units — how close head needs to be to anchor
  readonly BODY_WIDTH = 1.2;
  readonly BODY_HEIGHT = 1.2;

  constructor() {
    this.buildLevel();
  }

  /**
   * Build the level geometry.
   * TODO: Load from procedural generator.
   */
  private buildLevel() {
    this.surfaces = [];

    // Ground floor — wide concrete
    this.surfaces.push({ type: 'concrete', x: -20, y: -5, width: 60, height: 5 });

    // Stepped platforms going up
    const platforms = [
      { x: -5, y: 0, w: 6, type: 'concrete' as SurfaceType },
      { x: 3, y: 2, w: 5, type: 'concrete' as SurfaceType },
      { x: -8, y: 4, w: 5, type: 'concrete' as SurfaceType },
      { x: 0, y: 7, w: 4, type: 'concrete' as SurfaceType },
      { x: -4, y: 10, w: 4, type: 'concrete' as SurfaceType },
      { x: 2, y: 13, w: 5, type: 'concrete' as SurfaceType },
      // Silt slope — no friction, will slide
      { x: -10, y: 5, w: 3, h: 0.3, type: 'silt' as SurfaceType },
      // Glass platform
      { x: -2, y: 16, w: 4, h: 0.4, type: 'glass' as SurfaceType, breakVel: 15 },
      // Another concrete above glass
      { x: 1, y: 19, w: 5, type: 'concrete' as SurfaceType },
      // Faraday cage (no anchoring)
      { x: -6, y: 18, w: 3, h: 6, type: 'faraday' as SurfaceType },
      // Top platform
      { x: -3, y: 23, w: 6, type: 'concrete' as SurfaceType },
    ];

    for (const p of platforms) {
      this.surfaces.push({
        type: p.type,
        x: p.x,
        y: p.y,
        width: p.w,
        height: p.h ?? 0.4,
        breakVelocityThreshold: (p as any).breakVel,
      });
    }
  }

  /**
   * Find the nearest surface within anchor radius of a world point.
   */
  findAnchorTarget(headX: number, headY: number, inFaraday: boolean): CollisionResult {
    if (inFaraday) {
      return { hit: false, surface: null, hitX: headX, hitY: headY, normalX: 0, normalY: 0 };
    }

    let bestDist = this.ANCHOR_RADIUS;
    let best: CollisionResult | null = null;

    for (const surf of this.surfaces) {
      if (surf.type === 'air' || surf.broken) continue;
      if (surf.type === 'faraday') continue; // Can't anchor inside faraday

      // Check if head is within ANCHOR_RADIUS of this surface's edges
      const nearestX = Math.max(surf.x, Math.min(headX, surf.x + surf.width));
      const nearestY = Math.max(surf.y, Math.min(headY, surf.y + surf.height));
      const dx = headX - nearestX;
      const dy = headY - nearestY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        // Surface normal (which face is closest)
        let nx = 0, ny = 0;
        if (Math.abs(headX - nearestX) > Math.abs(headY - nearestY)) {
          nx = dx > 0 ? 1 : -1;
        } else {
          ny = dy > 0 ? 1 : -1;
        }
        best = {
          hit: true,
          surface: surf,
          hitX: nearestX,
          hitY: nearestY,
          normalX: nx,
          normalY: ny,
        };
      }
    }

    return best ?? { hit: false, surface: null, hitX: headX, hitY: headY, normalX: 0, normalY: 0 };
  }

  /**
   * Check body collision with all surfaces.
   */
  checkBodyCollision(bodyX: number, bodyY: number): { surface: Surface | null; grounded: boolean } {
    let grounded = false;
    let floorSurface: Surface | null = null;

    for (const surf of this.surfaces) {
      if (surf.type === 'air' || surf.broken) continue;

      const bw = this.BODY_WIDTH;
      const bh = this.BODY_HEIGHT;
      // Body bottom
      const bodyBottom = bodyY - bh / 2;
      const bodyLeft = bodyX - bw / 2;
      const bodyRight = bodyX + bw / 2;

      // Top face of surface
      if (aabbOverlap(bodyLeft, bodyBottom, bw, bh, surf.x, surf.y, surf.width, surf.height)) {
        if (surf.type === 'glass' && bodyY < surf.y + surf.height) {
          // Check break velocity
          // handled externally
        }
        if (!grounded || surf.y < (floorSurface?.y ?? Infinity)) {
          floorSurface = surf;
        }
        grounded = true;
      }
    }

    return { surface: floorSurface, grounded };
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
   * Break a glass surface if velocity is above threshold.
   */
  tryBreakGlass(surface: Surface, impactVelocity: number): boolean {
    if (surface.type === 'glass' && !surface.broken) {
      const threshold = surface.breakVelocityThreshold ?? 15;
      if (impactVelocity >= threshold) {
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
