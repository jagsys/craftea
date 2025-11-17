import { Node3D, Line3D } from '@/lib/core/Node3D';

/**
 * Check if two lines intersect in 3D space
 * Returns the intersection point if found, null otherwise
 */
function checkLineIntersection(
  line1: Line3D,
  line2: Line3D
): { x: number; y: number; z: number } | null {
  try {
    const p1 = line1.node1;
    const p2 = line1.node2;
    const q1 = line2.node1;
    const q2 = line2.node2;

    // Calculate direction vectors
    const d1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const d2 = { x: q2.x - q1.x, y: q2.y - q1.y, z: q2.z - q1.z };
    const w = { x: p1.x - q1.x, y: p1.y - q1.y, z: p1.z - q1.z };

    // Calculate coefficients for line intersection
    const a = d1.x * d1.x + d1.y * d1.y + d1.z * d1.z;
    const b = d1.x * d2.x + d1.y * d2.y + d1.z * d2.z;
    const c = d2.x * d2.x + d2.y * d2.y + d2.z * d2.z;
    const d = d1.x * w.x + d1.y * w.y + d1.z * w.z;
    const e = d2.x * w.x + d2.y * w.y + d2.z * w.z;

    const denom = a * c - b * b;

    // Check if lines are parallel
    if (Math.abs(denom) < 0.0001) {
      return null;
    }

    const t = (b * e - c * d) / denom;
    const s = (a * e - b * d) / denom;

    // Check if intersection is within both line segments
    const TOLERANCE = 0.005;
    if (t < TOLERANCE || t > (1 - TOLERANCE) || s < TOLERANCE || s > (1 - TOLERANCE)) {
      return null;
    }

    // Calculate intersection points on both lines
    const p_at_t = {
      x: p1.x + t * d1.x,
      y: p1.y + t * d1.y,
      z: p1.z + t * d1.z,
    };

    const q_at_s = {
      x: q1.x + s * d2.x,
      y: q1.y + s * d2.y,
      z: q1.z + s * d2.z,
    };

    // Check if the two points are close enough (lines actually intersect vs skew)
    const distance = Math.sqrt(
      Math.pow(p_at_t.x - q_at_s.x, 2) +
      Math.pow(p_at_t.y - q_at_s.y, 2) +
      Math.pow(p_at_t.z - q_at_s.z, 2)
    );

    if (distance > 0.5) {
      return null;
    }

    // Return the average point
    return {
      x: Math.round((p_at_t.x + q_at_s.x) / 2 * 1000) / 1000,
      y: Math.round((p_at_t.y + q_at_s.y) / 2 * 1000) / 1000,
      z: Math.round((p_at_t.z + q_at_s.z) / 2 * 1000) / 1000,
    };
  } catch (error) {
    console.error('Error in checkLineIntersection:', error);
    return null;
  }
}

/**
 * Check if a new line intersects with any existing lines
 * Returns intersection details if found
 */
export function findIntersections(
  newLine: Line3D,
  existingLines: Map<string, Line3D>
): Array<{ existingLine: Line3D; point: { x: number; y: number; z: number } }> {
  const intersections: Array<{ existingLine: Line3D; point: { x: number; y: number; z: number } }> = [];

  try {
    for (const [lineName, existingLine] of existingLines) {
      // Skip if lines share a node
      if (
        newLine.node1.name === existingLine.node1.name ||
        newLine.node1.name === existingLine.node2.name ||
        newLine.node2.name === existingLine.node1.name ||
        newLine.node2.name === existingLine.node2.name
      ) {
        continue;
      }

      const intersection = checkLineIntersection(newLine, existingLine);

      if (intersection) {
        console.log(`✂️  Intersection: ${newLine.name} ⨯ ${existingLine.name} at (${intersection.x}, ${intersection.y}, ${intersection.z})`);
        intersections.push({ existingLine, point: intersection });
      }
    }
  } catch (error) {
    console.error('Error in findIntersections:', error);
  }

  return intersections;
}

/**
 * Generate a unique node name
 */
function generateNodeName(existingNodes: Map<string, Node3D>): string {
  let counter = existingNodes.size + 1;
  while (existingNodes.has(`N${counter}`)) {
    counter++;
  }
  return `N${counter}`;
}

/**
 * Automatically fix intersections by creating nodes and splitting lines
 */
export function autoFixIntersections(
  newLine: Line3D,
  existingNodes: Map<string, Node3D>,
  existingLines: Map<string, Line3D>
): { nodes: Map<string, Node3D>; lines: Map<string, Line3D> } | null {
  try {
    const intersections = findIntersections(newLine, existingLines);

    if (intersections.length === 0) {
      // No intersections, just add the line normally
      const lines = new Map(existingLines);
      lines.set(newLine.name, newLine);
      return { nodes: existingNodes, lines };
    }

    // Create copies for modification
    const nodes = new Map(existingNodes);
    const lines = new Map(existingLines);

    // Add the new line first
    lines.set(newLine.name, newLine);

    // Process each intersection
    for (const { existingLine, point } of intersections) {
      // Create new node at intersection
      const nodeName = generateNodeName(nodes);
      const newNode = new Node3D(nodeName, point.x, point.y, point.z);
      nodes.set(nodeName, newNode);

      console.log(`   ➕ Created ${nodeName} at (${point.x}, ${point.y}, ${point.z})`);

      // Split the new line
      const newLine1 = lines.get(newLine.name);
      if (newLine1) {
        const splitA = new Line3D(`${newLine.name}a`, newLine1.node1, newNode);
        const splitB = new Line3D(`${newLine.name}b`, newNode, newLine1.node2);
        lines.delete(newLine.name);
        lines.set(splitA.name, splitA);
        lines.set(splitB.name, splitB);
        console.log(`   ✂️  Split ${newLine.name} → ${splitA.name}, ${splitB.name}`);
      }

      // Split the existing line
      const existingLineObj = lines.get(existingLine.name);
      if (existingLineObj) {
        const splitC = new Line3D(`${existingLine.name}a`, existingLineObj.node1, newNode);
        const splitD = new Line3D(`${existingLine.name}b`, newNode, existingLineObj.node2);
        lines.delete(existingLine.name);
        lines.set(splitC.name, splitC);
        lines.set(splitD.name, splitD);
        console.log(`   ✂️  Split ${existingLine.name} → ${splitC.name}, ${splitD.name}`);
      }
    }

    return { nodes, lines };
  } catch (error) {
    console.error('Error in autoFixIntersections:', error);
    // Return null to signal error - caller should handle by adding line without intersection detection
    return null;
  }
}
