import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({});

export const fixIntersectionsTool = ToolSchemaBuilder
  .withName('fixIntersections')
  .withDescription('Automatically detects line intersections and adds nodes at intersection points')
  .withInstructions(`Use this tool after creating complex structures with crossing lines (like pyramids with diagonal supports, cross-bracing, etc.).

This tool will:
1. Detect all line-line intersections in 3D space
2. Add nodes at each intersection point
3. Split the intersecting lines into segments
4. Ensure structural integrity

Call this after creating:
- Pyramids with diagonal supports
- Cross-braced structures
- Any geometry with crossing members`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'Create a cube with a pyramid on top, and fix all intersections',
    toolInput: {},
  })
  .build();

// Helper function to calculate line-line intersection in 3D
function lineLineIntersection(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
  q1: { x: number; y: number; z: number },
  q2: { x: number; y: number; z: number },
  debug: boolean = false
): { x: number; y: number; z: number; t: number; s: number } | null {
  // Line 1: P = p1 + t * (p2 - p1), t in [0, 1]
  // Line 2: Q = q1 + s * (q2 - q1), s in [0, 1]

  const d1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
  const d2 = { x: q2.x - q1.x, y: q2.y - q1.y, z: q2.z - q1.z };
  const w = { x: p1.x - q1.x, y: p1.y - q1.y, z: p1.z - q1.z };

  if (debug) {
    console.log(`      d1 (direction 1): (${d1.x}, ${d1.y}, ${d1.z})`);
    console.log(`      d2 (direction 2): (${d2.x}, ${d2.y}, ${d2.z})`);
  }

  // We need to solve: p1 + t*d1 = q1 + s*d2
  // Rearranged: t*d1 - s*d2 = q1 - p1 = -w

  // Use cross product to find the solution
  const a = d1.x * d1.x + d1.y * d1.y + d1.z * d1.z;
  const b = d1.x * d2.x + d1.y * d2.y + d1.z * d2.z;
  const c = d2.x * d2.x + d2.y * d2.y + d2.z * d2.z;
  const d = d1.x * w.x + d1.y * w.y + d1.z * w.z;
  const e = d2.x * w.x + d2.y * w.y + d2.z * w.z;

  const denom = a * c - b * b;

  if (debug) {
    console.log(`      a=${a.toFixed(4)}, b=${b.toFixed(4)}, c=${c.toFixed(4)}`);
    console.log(`      d=${d.toFixed(4)}, e=${e.toFixed(4)}, denom=${denom.toFixed(4)}`);
  }

  if (Math.abs(denom) < 0.0001) {
    if (debug) console.log(`      ❌ Lines are parallel or coincident (denom too small)`);
    return null;
  }

  const t = (b * e - c * d) / denom;
  const s = (a * e - b * d) / denom;

  if (debug) {
    console.log(`      t=${t.toFixed(4)}, s=${s.toFixed(4)}`);
  }

  // Check if intersection is within both line segments
  // Very relaxed tolerance: allow intersections anywhere from 0.5% to 99.5% along the segment
  // This prevents creating nodes at endpoints (which already exist) but catches all interior intersections
  const ENDPOINT_TOLERANCE = 0.005; // 0.5% from endpoints
  if (t < ENDPOINT_TOLERANCE || t > (1 - ENDPOINT_TOLERANCE) ||
      s < ENDPOINT_TOLERANCE || s > (1 - ENDPOINT_TOLERANCE)) {
    if (debug) {
      console.log(`      ❌ Intersection outside segment range`);
      console.log(`         t=${t.toFixed(6)} (need ${ENDPOINT_TOLERANCE} to ${1-ENDPOINT_TOLERANCE})`);
      console.log(`         s=${s.toFixed(6)} (need ${ENDPOINT_TOLERANCE} to ${1-ENDPOINT_TOLERANCE})`);
    }
    return null;
  }

  // Calculate intersection point
  const intersection = {
    x: p1.x + t * d1.x,
    y: p1.y + t * d1.y,
    z: p1.z + t * d1.z,
    t,
    s,
  };

  // Verify the lines actually intersect (not just skew)
  const q_at_s = {
    x: q1.x + s * d2.x,
    y: q1.y + s * d2.y,
    z: q1.z + s * d2.z,
  };

  const dist = Math.sqrt(
    Math.pow(intersection.x - q_at_s.x, 2) +
    Math.pow(intersection.y - q_at_s.y, 2) +
    Math.pow(intersection.z - q_at_s.z, 2)
  );

  if (debug) {
    console.log(`      Intersection point: (${intersection.x.toFixed(3)}, ${intersection.y.toFixed(3)}, ${intersection.z.toFixed(3)})`);
    console.log(`      Q at s: (${q_at_s.x.toFixed(3)}, ${q_at_s.y.toFixed(3)}, ${q_at_s.z.toFixed(3)})`);
    console.log(`      Distance between points: ${dist.toFixed(6)}`);
  }

  // Very relaxed tolerance: allow up to 0.5 units of distance for intersection
  // This accounts for floating point precision and near-misses in 3D space
  // Increased from 0.1 to 0.5 to catch more intersections that appear to cross but have slight 3D offset
  const DISTANCE_TOLERANCE = 0.5;
  if (dist > DISTANCE_TOLERANCE) {
    if (debug) console.log(`      ❌ Lines are skew (distance ${dist.toFixed(6)} > ${DISTANCE_TOLERANCE})`);
    return null;
  }

  if (debug) console.log(`      ✅ Valid intersection found!`);
  return intersection;
}

export async function executeFixIntersections(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { state } = context;

  if (state.lines.length < 2) {
    return {
      success: true,
      message: 'No intersections to fix (less than 2 lines)',
      data: {},
    };
  }

  const intersections: Array<{
    line1: string;
    line2: string;
    point: { x: number; y: number; z: number };
    t1: number;
    t2: number;
  }> = [];

  // Find all intersections
  console.log(`   🔍 Checking ${state.lines.length} lines for intersections...`);

  for (let i = 0; i < state.lines.length; i++) {
    for (let j = i + 1; j < state.lines.length; j++) {
      const line1 = state.lines[i];
      const line2 = state.lines[j];

      // Get nodes for line1
      const n1_1 = state.nodes.find(n => n.name === line1.node1);
      const n1_2 = state.nodes.find(n => n.name === line1.node2);

      // Get nodes for line2
      const n2_1 = state.nodes.find(n => n.name === line2.node1);
      const n2_2 = state.nodes.find(n => n.name === line2.node2);

      if (!n1_1 || !n1_2 || !n2_1 || !n2_2) continue;

      // Skip if lines share a node (they're already connected)
      if (line1.node1 === line2.node1 || line1.node1 === line2.node2 ||
          line1.node2 === line2.node1 || line1.node2 === line2.node2) {
        continue;
      }

      console.log(`   🔎 Checking ${line1.name} (${line1.node1}-${line1.node2}) vs ${line2.name} (${line2.node1}-${line2.node2})`);
      console.log(`      Line 1: (${n1_1.x}, ${n1_1.y}, ${n1_1.z}) → (${n1_2.x}, ${n1_2.y}, ${n1_2.z})`);
      console.log(`      Line 2: (${n2_1.x}, ${n2_1.y}, ${n2_1.z}) → (${n2_2.x}, ${n2_2.y}, ${n2_2.z})`);

      const intersection = lineLineIntersection(n1_1, n1_2, n2_1, n2_2, true); // Enable debug

      if (intersection) {
        console.log(`   ✓ Found intersection between ${line1.name} and ${line2.name} at (${intersection.x.toFixed(2)}, ${intersection.y.toFixed(2)}, ${intersection.z.toFixed(2)})`);
        intersections.push({
          line1: line1.name,
          line2: line2.name,
          point: { x: intersection.x, y: intersection.y, z: intersection.z },
          t1: intersection.t,
          t2: intersection.s,
        });
      }
    }
  }

  if (intersections.length === 0) {
    console.log(`   ℹ️  No intersections found`);
    console.log(`   Possible reasons:`);
    console.log(`   • Lines are parallel (direction vectors are proportional)`);
    console.log(`   • Lines are skew (pass by each other in 3D, distance > 0.5 units)`);
    console.log(`   • Lines already share an endpoint (already connected)`);
    console.log(`   • Intersection is too close to an endpoint (< 0.5% from endpoint)`);
    console.log(`   💡 Tip: Check the debug output above for specific rejection reasons`);
    return {
      success: true,
      message: 'No intersections found - structure is already clean!',
      data: {
        linesChecked: state.lines.length,
        intersectionsFound: 0,
      },
    };
  }

  console.log(`   🔍 Found ${intersections.length} intersection(s)`);

  // Track created nodes and modified lines
  const createdNodes: any[] = [];
  const modifiedLines: any[] = [];
  const removedLines: string[] = [];

  // Process each intersection
  let nodeCounter = state.nodes.length + 1;

  for (const intersection of intersections) {
    const line1 = state.lines.find(l => l.name === intersection.line1);
    const line2 = state.lines.find(l => l.name === intersection.line2);

    if (!line1 || !line2) continue;

    // Create new node at intersection
    const newNodeName = `N${nodeCounter++}`;
    const newNode = {
      name: newNodeName,
      x: Math.round(intersection.point.x * 1000) / 1000,
      y: Math.round(intersection.point.y * 1000) / 1000,
      z: Math.round(intersection.point.z * 1000) / 1000,
    };

    state.nodes.push(newNode);
    createdNodes.push(newNode);
    console.log(`   ➕ Created ${newNodeName} at (${newNode.x}, ${newNode.y}, ${newNode.z})`);

    // Split line1
    const line1a = {
      name: `${line1.name}a`,
      node1: line1.node1,
      node2: newNodeName,
    };
    const line1b = {
      name: `${line1.name}b`,
      node1: newNodeName,
      node2: line1.node2,
    };

    // Split line2
    const line2a = {
      name: `${line2.name}a`,
      node1: line2.node1,
      node2: newNodeName,
    };
    const line2b = {
      name: `${line2.name}b`,
      node1: newNodeName,
      node2: line2.node2,
    };

    // Remove original lines
    state.lines = state.lines.filter(l => l.name !== line1.name && l.name !== line2.name);
    removedLines.push(line1.name, line2.name);

    // Add split lines
    state.lines.push(line1a, line1b, line2a, line2b);
    modifiedLines.push(line1a, line1b, line2a, line2b);

    console.log(`   ✂️  Split ${line1.name} → ${line1a.name}, ${line1b.name}`);
    console.log(`   ✂️  Split ${line2.name} → ${line2a.name}, ${line2b.name}`);
  }

  return {
    success: true,
    message: `Fixed ${intersections.length} intersection(s): added ${createdNodes.length} node(s) and split ${removedLines.length} line(s)`,
    data: {
      intersectionsFixed: intersections.length,
      nodesAdded: createdNodes,
      linesModified: modifiedLines,
    },
  };
}
