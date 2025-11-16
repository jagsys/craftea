export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface ProjectionState {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface Node3DData {
  id?: number;
  name: string;
  x: number;
  y: number;
  z: number;
}

export interface Line3DData {
  id?: number;
  name: string;
  node1Id: number;
  node2Id: number;
}

export interface ProjectData {
  id?: number;
  name: string;
  description?: string;
  nodes: Node3DData[];
  lines: Line3DData[];
  view?: ProjectionState;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DetectedShape {
  type: 'rectangle';
  nodes: Node3DData[];
  id: number;
}
