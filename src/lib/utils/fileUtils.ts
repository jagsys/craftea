import { Node3D, Line3D } from '@/lib/core/Node3D';

interface SavedProject {
  name: string;
  nodes: Array<{ name: string; x: number; y: number; z: number }>;
  lines: Array<{ name: string; node1: string; node2: string }>;
}

export const exportToJSON = (
  nodes: Map<string, Node3D>,
  lines: Map<string, Line3D>,
  projectName = 'craftea-project'
): void => {
  const data: SavedProject = {
    name: projectName,
    nodes: Array.from(nodes.values()).map((node) => ({
      name: node.name,
      x: node.x,
      y: node.y,
      z: node.z,
    })),
    lines: Array.from(lines.values()).map((line) => ({
      name: line.name,
      node1: line.node1.name,
      node2: line.node2.name,
    })),
  };

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const importFromJSON = async (
  file: File
): Promise<{ nodes: Node3D[]; lines: Line3D[] }> => {
  const text = await file.text();
  const data = JSON.parse(text) as SavedProject;

  const nodeMap = new Map<string, Node3D>();
  const nodes: Node3D[] = [];

  for (const nodeData of data.nodes) {
    const node = new Node3D(nodeData.name, nodeData.x, nodeData.y, nodeData.z);
    nodes.push(node);
    nodeMap.set(node.name, node);
  }

  const lines: Line3D[] = [];
  for (const lineData of data.lines) {
    const node1 = nodeMap.get(lineData.node1);
    const node2 = nodeMap.get(lineData.node2);

    if (node1 && node2) {
      const line = new Line3D(lineData.name, node1, node2);
      lines.push(line);
    }
  }

  return { nodes, lines };
};
