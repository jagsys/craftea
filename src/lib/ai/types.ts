export interface Node3DData {
  name: string;
  x: number;
  y: number;
  z: number;
}

export interface Line3DData {
  name: string;
  node1: string;
  node2: string;
}

export interface CrafteaState {
  nodes: Node3DData[];
  lines: Line3DData[];
  is2DMode?: boolean;
}

export interface ToolContext {
  state: CrafteaState;
}

export type ToolResult = {
  success: boolean;
  message: string;
  data?: any;
};
