import type { Point2D, ProjectionState } from '@/types/models';
import type { Node3D } from './Node3D';

const ROTATION_STEP = 45;
const MIN_SCALE = 1;
const MAX_SCALE = 100;
const DEFAULT_SCALE = 20;
const ASPECT_RATIO = 0.5;
const AUTOFIT_MARGIN = 0.8;

export class Projection3D {
  rotationX = 0;
  rotationY = 0;
  rotationZ = 0;
  scale = DEFAULT_SCALE;
  offsetX = 0;
  offsetY = 0;
  aspectRatio = ASPECT_RATIO;

  rotateX(direction = 1): void {
    this.rotationX = (this.rotationX + direction * ROTATION_STEP) % 360;
  }

  rotateY(direction = 1): void {
    this.rotationY = (this.rotationY + direction * ROTATION_STEP) % 360;
  }

  rotateZ(direction = 1): void {
    this.rotationZ = (this.rotationZ + direction * ROTATION_STEP) % 360;
  }

  project(x: number, y: number, z: number): Point2D {
    const rx = this.toRadians(this.rotationX);
    const ry = this.toRadians(this.rotationY);
    const rz = this.toRadians(this.rotationZ);

    const { x: x1, y: y1, z: z1 } = this.rotateAroundX(x, y, z, rx);
    const { x: x2, y: y2, z: z2 } = this.rotateAroundY(x1, y1, z1, ry);
    const { x: x3, y: y3 } = this.rotateAroundZ(x2, y2, z2, rz);

    return {
      x: Math.round(x3 * this.scale + this.offsetX),
      y: Math.round(y3 * this.scale * this.aspectRatio + this.offsetY),
    };
  }

  autoFit(nodes: Node3D[], width: number, height: number): void {
    if (nodes.length === 0) {
      this.scale = DEFAULT_SCALE;
      return;
    }

    const bounds = this.calculateBounds(nodes);

    if (bounds.rangeX === 0 && bounds.rangeY === 0) {
      this.scale = DEFAULT_SCALE;
      return;
    }

    const scaleX = bounds.rangeX > 0 ? (width * AUTOFIT_MARGIN) / bounds.rangeX : Infinity;
    const scaleY = bounds.rangeY > 0 ? (height * AUTOFIT_MARGIN) / bounds.rangeY : Infinity;
    const targetScale = Math.min(scaleX, scaleY) * this.scale / DEFAULT_SCALE;

    this.scale = this.clampScale(targetScale);
  }

  setScale(scale: number): void {
    this.scale = this.clampScale(scale);
  }

  zoom(factor: number): void {
    this.scale = this.clampScale(this.scale * factor);
  }

  pan(deltaX: number, deltaY: number): void {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
  }

  resetOffset(): void {
    this.offsetX = 0;
    this.offsetY = 0;
  }

  getState(): ProjectionState {
    return {
      rotationX: this.rotationX,
      rotationY: this.rotationY,
      rotationZ: this.rotationZ,
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    };
  }

  setState(state: ProjectionState): void {
    this.rotationX = state.rotationX;
    this.rotationY = state.rotationY;
    this.rotationZ = state.rotationZ;
    this.scale = state.scale;
    this.offsetX = state.offsetX;
    this.offsetY = state.offsetY;
  }

  private toRadians = (degrees: number): number => degrees * Math.PI / 180;

  private clampScale = (scale: number): number =>
    Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

  private rotateAroundX(x: number, y: number, z: number, rx: number) {
    return {
      x,
      y: y * Math.cos(rx) - z * Math.sin(rx),
      z: y * Math.sin(rx) + z * Math.cos(rx),
    };
  }

  private rotateAroundY(x: number, y: number, z: number, ry: number) {
    return {
      x: x * Math.cos(ry) + z * Math.sin(ry),
      y,
      z: -x * Math.sin(ry) + z * Math.cos(ry),
    };
  }

  private rotateAroundZ(x: number, y: number, z: number, rz: number) {
    return {
      x: x * Math.cos(rz) - y * Math.sin(rz),
      y: x * Math.sin(rz) + y * Math.cos(rz),
      z,
    };
  }

  private calculateBounds(nodes: Node3D[]) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      const projected = this.project(node.x, node.y, node.z);
      minX = Math.min(minX, projected.x);
      maxX = Math.max(maxX, projected.x);
      minY = Math.min(minY, projected.y);
      maxY = Math.max(maxY, projected.y);
    }

    return {
      minX,
      maxX,
      minY,
      maxY,
      rangeX: maxX - minX,
      rangeY: maxY - minY,
    };
  }
}
