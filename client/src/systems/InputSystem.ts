/**
 * InputSystem.ts — Mouse/keyboard input for the flail game.
 *
 * Handles:
 * - Mouse position (converted to world coords)
 * - Left click (anchor)
 * - Pointer lock for camera rotation
 */

export interface MouseState {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  leftDown: boolean;
  leftJustPressed: boolean;
  leftJustReleased: boolean;
}

export class InputSystem {
  private _mouse: MouseState = {
    screenX: 0,
    screenY: 0,
    worldX: 0,
    worldY: 0,
    leftDown: false,
    leftJustPressed: false,
    leftJustReleased: false,
  };

  private prevLeftDown = false;
  private canvas: HTMLCanvasElement | null = null;

  constructor() {
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
  }

  /**
   * Attach listeners to a canvas element.
   */
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd);
  }

  detach() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas = null;
  }

  private onMouseMove(e: MouseEvent) {
    this._mouse.screenX = e.clientX;
    this._mouse.screenY = e.clientY;
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      this._mouse.leftDown = true;
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      this._mouse.leftDown = false;
    }
  }

  private onTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length > 0) {
      this._mouse.screenX = e.touches[0].clientX;
      this._mouse.screenY = e.touches[0].clientY;
      this._mouse.leftDown = true;
    }
  }

  private onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length > 0) {
      this._mouse.screenX = e.touches[0].clientX;
      this._mouse.screenY = e.touches[0].clientY;
    }
  }

  private onTouchEnd(e: TouchEvent) {
    this._mouse.leftDown = false;
  }

  /**
   * Call each frame to compute one-frame events.
   */
  update() {
    this._mouse.leftJustPressed = this._mouse.leftDown && !this.prevLeftDown;
    this._mouse.leftJustReleased = !this._mouse.leftDown && this.prevLeftDown;
    this.prevLeftDown = this._mouse.leftDown;
  }

  /**
   * Update world coords from screen coords.
   * Must be called with the current camera info.
   */
  updateWorldCoords(
    viewWidth: number,
    viewHeight: number,
    cameraX: number,
    cameraY: number,
    worldUnitsPerPixel: number
  ) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const pixelX = this._mouse.screenX - rect.left;
    const pixelY = this._mouse.screenY - rect.top;

    // Convert screen pixel to world unit offset from camera center
    const centerX = viewWidth / 2;
    const centerY = viewHeight / 2;
    this._mouse.worldX = cameraX + (pixelX - centerX) * worldUnitsPerPixel;
    this._mouse.worldY = cameraY + (pixelY - centerY) * worldUnitsPerPixel;
  }

  get mouse(): MouseState {
    return this._mouse;
  }
}
