import { create } from 'zustand';
import { Node3D, Line3D } from '@/lib/core/Node3D';
import { Projection3D } from '@/lib/core/Projection3D';
import { autoFixIntersections } from '@/lib/utils/intersectionDetector';

interface HistoryState {
  nodes: Map<string, Node3D>;
  lines: Map<string, Line3D>;
}

interface EditorState {
  nodes: Map<string, Node3D>;
  lines: Map<string, Line3D>;
  projection: Projection3D;
  selectedNodeId: string | null;
  currentProject: { id?: number; name: string } | null;
  gridSize: number;
  showAxisLabels: boolean;
  showNodes: boolean;
  showLineLabels: boolean;
  is2DMode: boolean;
  history: HistoryState[];
  historyIndex: number;
  addNode: (node: Node3D) => void;
  removeNode: (name: string) => void;
  addLine: (line: Line3D) => void;
  removeLine: (name: string) => void;
  clear: () => void;
  setSelectedNode: (name: string | null) => void;
  setGridSize: (size: number) => void;
  setShowAxisLabels: (show: boolean) => void;
  setShowNodes: (show: boolean) => void;
  setShowLineLabels: (show: boolean) => void;
  set2DMode: (is2D: boolean) => void;
  loadProject: (nodes: Node3D[], lines: Line3D[], projectInfo?: { id?: number; name: string }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveHistory: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: new Map(),
  lines: new Map(),
  projection: new Projection3D(),
  selectedNodeId: null,
  currentProject: null,
  gridSize: 10,
  showAxisLabels: true,
  showNodes: true,
  showLineLabels: true,
  is2DMode: false,
  history: [{ nodes: new Map(), lines: new Map() }],
  historyIndex: 0,

  saveHistory: () =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        nodes: new Map(state.nodes),
        lines: new Map(state.lines),
      });
      // Limit history to 50 states
      if (newHistory.length > 50) {
        newHistory.shift();
        return {
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  addNode: (node) =>
    set((state) => {
      const newNodes = new Map(state.nodes);
      newNodes.set(node.name, node);
      return { nodes: newNodes };
    }),

  removeNode: (name) =>
    set((state) => {
      const newNodes = new Map(state.nodes);
      const newLines = new Map(state.lines);

      newNodes.delete(name);

      for (const [lineName, line] of newLines) {
        if (line.node1.name === name || line.node2.name === name) {
          newLines.delete(lineName);
        }
      }

      return { nodes: newNodes, lines: newLines };
    }),

  addLine: (line) =>
    set((state) => {
      try {
        // Try automatic intersection detection
        const result = autoFixIntersections(line, state.nodes, state.lines);

        if (result) {
          // Successfully detected and fixed intersections
          return { nodes: result.nodes, lines: result.lines };
        } else {
          // Error in intersection detection, fall back to normal behavior
          console.warn('Intersection detection failed, adding line without detection');
          const newLines = new Map(state.lines);
          newLines.set(line.name, line);
          return { lines: newLines };
        }
      } catch (error) {
        // Catch any unexpected errors
        console.error('Error in addLine with intersection detection:', error);
        // Fall back to normal behavior
        const newLines = new Map(state.lines);
        newLines.set(line.name, line);
        return { lines: newLines };
      }
    }),

  removeLine: (name) =>
    set((state) => {
      const newLines = new Map(state.lines);
      newLines.delete(name);
      return { lines: newLines };
    }),

  clear: () =>
    set({
      nodes: new Map(),
      lines: new Map(),
      selectedNodeId: null,
    }),

  setSelectedNode: (name) =>
    set({ selectedNodeId: name }),

  setGridSize: (size) =>
    set({ gridSize: Math.max(1, Math.min(100, size)) }),

  setShowAxisLabels: (show) =>
    set({ showAxisLabels: show }),

  setShowNodes: (show) =>
    set({ showNodes: show }),

  setShowLineLabels: (show) =>
    set({ showLineLabels: show }),

  set2DMode: (is2D) =>
    set({ is2DMode: is2D }),

  loadProject: (nodes, lines, projectInfo) =>
    set((state) => {
      const newNodes = new Map(nodes.map((n) => [n.name, n]));
      const newLines = new Map(lines.map((l) => [l.name, l]));

      // Add to history
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({
        nodes: newNodes,
        lines: newLines,
      });

      return {
        nodes: newNodes,
        lines: newLines,
        currentProject: projectInfo ?? null,
        selectedNodeId: null,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        const historyState = state.history[newIndex];
        return {
          nodes: new Map(historyState.nodes),
          lines: new Map(historyState.lines),
          historyIndex: newIndex,
        };
      }
      return state;
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        const historyState = state.history[newIndex];
        return {
          nodes: new Map(historyState.nodes),
          lines: new Map(historyState.lines),
          historyIndex: newIndex,
        };
      }
      return state;
    }),

  canUndo: () => {
    const state = get();
    return state.historyIndex > 0;
  },

  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },
}));
