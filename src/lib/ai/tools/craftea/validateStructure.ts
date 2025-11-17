import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({});

export const validateStructureTool = ToolSchemaBuilder
  .withName('validateStructure')
  .withDescription('Validates structural and logical correctness with gravity-aware analysis')
  .withInstructions(`This tool analyzes the current structure to detect logical errors and missing connections, including physics-based gravity analysis.

VALIDATION CHECKS:
1. **Y-axis Grouping**: Detects illogical connections between structural levels
   - Floor nodes (y=0 or lowest)
   - Wall nodes (mid-height)
   - Roof/ceiling nodes (highest y values)

2. **Missing Structural Connections**: Detects incomplete structures
   - Incomplete roof pyramids (roof apex should connect to ALL wall-top corners)
   - Incomplete floor perimeters (all 4 edges for rectangular floors)
   - Missing vertical walls (corner posts from floor to wall-tops)

3. **Gravity-Based Analysis**: Physics-aware structural stability
   - Detects floating structures with no path to ground
   - Identifies nodes that need vertical supports
   - Validates load paths from top to bottom
   - Example: A roof without walls underneath would be flagged as floating

4. **Structural Logic**: Validates purpose and function
   - Roof apexes should connect to wall-tops, not floor
   - All elements must have continuous structural path to ground
   - Load-bearing connections must exist

⚠️ CIRCUIT BREAKER: If validation fails 3+ times with the same errors, this tool will trigger a circuit breaker.

IMPORTANT: If you receive a circuit breaker warning with "conflictingRequirements: true":
- The validator has detected CONTRADICTORY requirements (e.g., "no diagonals" vs "need supports")
- This often means you're building a BRIDGE or CUSTOM structure, not a HOUSE
- Validation rules designed for houses DON'T apply to bridges/custom designs
- STOP trying to satisfy both requirements - it's impossible!
- Instead, ask the user whether to skip validation or use a different approach
- DO NOT delete and recreate the same lines repeatedly

Returns:
- valid: true if structure is logically correct and stable
- valid: false if structural issues found
- errors: Array of errors (illogical connections, missing supports, floating elements)
- suggestions: Array of recommended fixes with specific node pairs
- circuitBreakerTriggered: true if infinite loop detected`)
  .withInputSchema(inputSchema)
  .build();

interface StructuralError {
  type: 'illogical_connection' | 'missing_connection' | 'incomplete_structure';
  severity: 'critical' | 'warning';
  description: string;
  affectedNodes?: string[];
  affectedLines?: string[];
  suggestedFix?: string;
}

// Track validation attempts to detect infinite loops
const validationHistory = new Map<string, {
  count: number;
  lastErrorSignature: string;
  lastActions: string[];
}>();

export async function executeValidateStructure(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { state } = context;
  const errors: StructuralError[] = [];
  const suggestions: string[] = [];

  console.log('   🔍 Validating structural logic...');
  console.log(`   Analyzing ${state.nodes.length} nodes and ${state.lines.length} lines`);

  if (state.nodes.length === 0) {
    return {
      success: true,
      message: 'No structure to validate (no nodes)',
      data: { valid: true, errors: [], suggestions: [] },
    };
  }

  // Step 1: Categorize nodes by Y-axis levels
  const yValues = state.nodes.map(n => n.y).sort((a, b) => a - b);
  const uniqueY = [...new Set(yValues)];

  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const yRange = maxY - minY;

  console.log(`   📊 Y-axis range: ${minY} to ${maxY} (range: ${yRange})`);
  console.log(`   📏 Y-levels: ${uniqueY.join(', ')}`);

  // Categorize nodes into structural levels
  const floorNodes = state.nodes.filter(n => Math.abs(n.y - minY) < 0.1);
  const roofNodes = state.nodes.filter(n => Math.abs(n.y - maxY) < 0.1);

  // Mid-level nodes (walls, etc.) - not at floor or roof
  const midNodes = state.nodes.filter(n =>
    Math.abs(n.y - minY) >= 0.1 && Math.abs(n.y - maxY) >= 0.1
  );

  console.log(`   🏗️  Floor level (y=${minY.toFixed(2)}): ${floorNodes.map(n => n.name).join(', ')}`);
  if (midNodes.length > 0) {
    const midLevels = [...new Set(midNodes.map(n => n.y))];
    midLevels.forEach(y => {
      const nodesAtLevel = midNodes.filter(n => Math.abs(n.y - y) < 0.1);
      console.log(`   🧱 Mid level (y=${y.toFixed(2)}): ${nodesAtLevel.map(n => n.name).join(', ')}`);
    });
  }
  console.log(`   🏠 Roof level (y=${maxY.toFixed(2)}): ${roofNodes.map(n => n.name).join(', ')}`);

  // Step 2: Check for illogical connections
  console.log('   🔎 Checking for illogical connections...');

  for (const line of state.lines) {
    const node1 = state.nodes.find(n => n.name === line.node1);
    const node2 = state.nodes.find(n => n.name === line.node2);

    if (!node1 || !node2) continue;

    const yDiff = Math.abs(node1.y - node2.y);
    const avgY = (node1.y + node2.y) / 2;

    // Check for illogical cross-level connections
    const isFloor1 = Math.abs(node1.y - minY) < 0.1;
    const isFloor2 = Math.abs(node2.y - minY) < 0.1;
    const isMid1 = !isFloor1 && Math.abs(node1.y - maxY) >= 0.1;
    const isMid2 = !isFloor2 && Math.abs(node2.y - maxY) >= 0.1;
    const isRoof1 = Math.abs(node1.y - maxY) < 0.1;
    const isRoof2 = Math.abs(node2.y - maxY) < 0.1;

    // Check if it's a vertical support (same X and Z)
    const isVertical = Math.abs(node1.x - node2.x) < 0.1 && Math.abs(node1.z - node2.z) < 0.1;

    // Critical error: Direct connection from roof to floor (non-vertical)
    if ((isRoof1 && isFloor2) || (isFloor1 && isRoof2)) {
      if (!isVertical) {
        errors.push({
          type: 'illogical_connection',
          severity: 'critical',
          description: `Line ${line.name} connects ${line.node1} (${isRoof1 ? 'roof' : 'floor'} at y=${node1.y}) to ${line.node2} (${isRoof2 ? 'roof' : 'floor'} at y=${node2.y}) - illogical diagonal from roof to floor`,
          affectedNodes: [line.node1, line.node2],
          affectedLines: [line.name],
          suggestedFix: `Remove ${line.name}. Roof nodes should connect to wall-top nodes, not floor nodes.`,
        });
        console.log(`   ❌ ${line.name}: Illogical roof-to-floor connection`);
      }
    }

    // Critical error: Wall-top to floor diagonal (should be rectangular perimeter edges instead)
    if ((isMid1 && isFloor2) || (isFloor1 && isMid2)) {
      if (!isVertical) {
        errors.push({
          type: 'illogical_connection',
          severity: 'critical',
          description: `Line ${line.name} connects ${line.node1} (${isMid1 ? 'wall-top' : 'floor'} at y=${node1.y}) to ${line.node2} (${isMid2 ? 'wall-top' : 'floor'} at y=${node2.y}) - should be rectangular perimeter edges instead`,
          affectedNodes: [line.node1, line.node2],
          affectedLines: [line.name],
          suggestedFix: `Remove ${line.name}. Replace with horizontal perimeter edges at each level.`,
        });
        console.log(`   ❌ ${line.name}: Illogical wall-top-to-floor diagonal`);
      }
    }

    // Warning: Very large Y-span connections (might be structural supports, but worth checking)
    if (yDiff > yRange * 0.8 && yDiff > 2) {
      const isLikelySupport = Math.abs(node1.x - node2.x) < 0.1 && Math.abs(node1.z - node2.z) < 0.1;
      if (!isLikelySupport) {
        errors.push({
          type: 'illogical_connection',
          severity: 'warning',
          description: `Line ${line.name} spans large vertical distance (${yDiff.toFixed(2)} units) from ${line.node1} to ${line.node2} - verify this is intentional`,
          affectedLines: [line.name],
          suggestedFix: 'Review if this diagonal makes structural sense',
        });
      }
    }
  }

  // Step 3: Check for missing structural connections
  console.log('   🔎 Checking for missing structural connections...');

  // 3a. Check roof structure completeness
  if (roofNodes.length > 0) {
    console.log('   🏠 Analyzing roof structure...');

    // Find potential roof apexes (highest unique Y values with fewer nodes)
    const roofApexes = roofNodes.filter(apex => {
      // An apex typically has fewer nodes at its Y level than the base
      const nodesAtSameY = roofNodes.filter(n => Math.abs(n.y - apex.y) < 0.1);
      return nodesAtSameY.length <= 2; // Apex should be a peak, not a full perimeter
    });

    // Find wall-top nodes (nodes just below roof level)
    const wallTopY = uniqueY[uniqueY.length - 2]; // Second highest Y level
    const wallTopNodes = wallTopY !== undefined
      ? state.nodes.filter(n => Math.abs(n.y - wallTopY) < 0.1)
      : [];

    if (roofApexes.length > 0 && wallTopNodes.length > 0) {
      console.log(`   🔺 Roof apexes: ${roofApexes.map(n => n.name).join(', ')}`);
      console.log(`   🧱 Wall-top nodes: ${wallTopNodes.map(n => n.name).join(', ')}`);

      // For each apex, check if it connects to adjacent wall-top corners
      for (const apex of roofApexes) {
        // Find wall-top nodes that should connect to this apex
        // (nodes at similar X or Z position, forming a roof triangle)
        const connectedWallNodes = wallTopNodes.filter(wallNode => {
          const hasLine = state.lines.some(line =>
            (line.node1 === apex.name && line.node2 === wallNode.name) ||
            (line.node2 === apex.name && line.node1 === wallNode.name)
          );
          return hasLine;
        });

        console.log(`   📐 ${apex.name} connected to ${connectedWallNodes.length}/${wallTopNodes.length} wall-top nodes: ${connectedWallNodes.map(n => n.name).join(', ')}`);

        // For a rectangular base (4 wall-top corners), ALL 4 should connect to the apex
        const expectedConnections = wallTopNodes.length === 4 ? 4 : 2; // 4 for rectangular, at least 2 otherwise

        if (connectedWallNodes.length < expectedConnections) {
          const missingConnections = wallTopNodes.filter(wallNode =>
            !connectedWallNodes.includes(wallNode)
          );

          errors.push({
            type: 'missing_connection',
            severity: 'critical',
            description: `Roof apex ${apex.name} only connects to ${connectedWallNodes.length}/${wallTopNodes.length} wall-top nodes - incomplete roof pyramid`,
            affectedNodes: [apex.name, ...missingConnections.map(n => n.name)],
            suggestedFix: `Add roof slope lines from ${apex.name} to: ${missingConnections.map(n => n.name).join(', ')}`,
          });

          missingConnections.forEach(wallNode => {
            suggestions.push(`Add line from ${apex.name} (roof apex) to ${wallNode.name} (wall-top)`);
            console.log(`   ❌ Missing roof slope: ${apex.name} → ${wallNode.name}`);
          });
        } else {
          console.log(`   ✅ Roof pyramid complete (all ${wallTopNodes.length} slopes present)`);
        }
      }
    }
  }

  // 3b. Check for vertical walls connecting floor to wall-tops
  if (floorNodes.length > 0 && midNodes.length > 0) {
    console.log('   🏗️  Analyzing vertical walls...');

    // For buildings/houses, check if floor nodes connect vertically to wall-top nodes
    // A floor node should have a vertical wall to a wall-top node at the same X,Z position
    for (const floorNode of floorNodes) {
      // Find wall-top node at same X,Z position
      const wallTopNode = midNodes.find(wt =>
        Math.abs(wt.x - floorNode.x) < 0.1 &&
        Math.abs(wt.z - floorNode.z) < 0.1 &&
        wt.y > floorNode.y
      );

      if (wallTopNode) {
        // Check if there's a vertical line connecting them
        const hasVerticalWall = state.lines.some(line =>
          (line.node1 === floorNode.name && line.node2 === wallTopNode.name) ||
          (line.node2 === floorNode.name && line.node1 === wallTopNode.name)
        );

        if (!hasVerticalWall) {
          errors.push({
            type: 'missing_connection',
            severity: 'critical',
            description: `Missing vertical wall from ${floorNode.name} (floor) to ${wallTopNode.name} (wall-top)`,
            affectedNodes: [floorNode.name, wallTopNode.name],
            suggestedFix: `Add vertical wall line from ${floorNode.name} to ${wallTopNode.name}`,
          });
          suggestions.push(`Add line from ${floorNode.name} to ${wallTopNode.name} (vertical wall)`);
          console.log(`   ❌ Missing vertical wall: ${floorNode.name} → ${wallTopNode.name}`);
        } else {
          console.log(`   ✅ Vertical wall: ${floorNode.name} → ${wallTopNode.name}`);
        }
      }
    }
  }

  // 3c. Check floor/base completeness for rectangular structures
  if (floorNodes.length === 4) {
    console.log('   🏗️  Analyzing floor rectangle...');

    // For a 4-corner floor, check if it forms a complete rectangle
    // Sort nodes to find corners: bottom-left, bottom-right, top-right, top-left
    const sorted = [...floorNodes].sort((a, b) => {
      if (Math.abs(a.z - b.z) > 0.1) return a.z - b.z; // Sort by Z first
      return a.x - b.x; // Then by X
    });

    // Identify corners (assuming rectangular layout)
    const corners = {
      frontLeft: sorted.find(n => n.x === Math.min(...floorNodes.map(f => f.x)) && n.z === Math.min(...floorNodes.map(f => f.z))),
      frontRight: sorted.find(n => n.x === Math.max(...floorNodes.map(f => f.x)) && n.z === Math.min(...floorNodes.map(f => f.z))),
      backRight: sorted.find(n => n.x === Math.max(...floorNodes.map(f => f.x)) && n.z === Math.max(...floorNodes.map(f => f.z))),
      backLeft: sorted.find(n => n.x === Math.min(...floorNodes.map(f => f.x)) && n.z === Math.max(...floorNodes.map(f => f.z))),
    };

    // Define the 4 edges of a rectangle
    const requiredEdges = [
      [corners.frontLeft, corners.frontRight, 'front edge'],
      [corners.frontRight, corners.backRight, 'right edge'],
      [corners.backRight, corners.backLeft, 'back edge'],
      [corners.backLeft, corners.frontLeft, 'left edge'],
    ];

    requiredEdges.forEach(([n1, n2, edgeName]) => {
      if (!n1 || !n2) return;

      const hasConnection = state.lines.some(line =>
        (line.node1 === n1.name && line.node2 === n2.name) ||
        (line.node2 === n1.name && line.node1 === n2.name)
      );

      if (!hasConnection) {
        errors.push({
          type: 'missing_connection',
          severity: 'critical',
          description: `Floor ${edgeName} missing: ${n1.name} to ${n2.name} - incomplete floor perimeter`,
          affectedNodes: [n1.name, n2.name],
          suggestedFix: `Add line connecting ${n1.name} to ${n2.name} (floor ${edgeName})`,
        });
        suggestions.push(`Add line from ${n1.name} to ${n2.name} (floor ${edgeName})`);
        console.log(`   ❌ Missing floor ${edgeName}: ${n1.name} → ${n2.name}`);
      } else {
        console.log(`   ✅ Floor ${edgeName}: ${n1.name} → ${n2.name}`);
      }
    });
  } else if (floorNodes.length > 4) {
    console.log('   🏗️  Analyzing floor perimeter (non-rectangular)...');

    // For non-rectangular floors, check adjacent connections
    // Group floor nodes by Z coordinate (front/back planes)
    const zGroups: { [z: number]: typeof floorNodes } = {};
    floorNodes.forEach(node => {
      const zKey = Math.round(node.z * 10) / 10;
      if (!zGroups[zKey]) zGroups[zKey] = [];
      zGroups[zKey].push(node);
    });

    // Check horizontal connections within each Z plane
    Object.entries(zGroups).forEach(([z, nodes]) => {
      if (nodes.length >= 2) {
        const sortedByX = [...nodes].sort((a, b) => a.x - b.x);
        for (let i = 0; i < sortedByX.length - 1; i++) {
          const n1 = sortedByX[i];
          const n2 = sortedByX[i + 1];

          const hasConnection = state.lines.some(line =>
            (line.node1 === n1.name && line.node2 === n2.name) ||
            (line.node2 === n1.name && line.node1 === n2.name)
          );

          if (!hasConnection) {
            errors.push({
              type: 'missing_connection',
              severity: 'warning',
              description: `Floor nodes ${n1.name} and ${n2.name} at z=${z} are not connected`,
              affectedNodes: [n1.name, n2.name],
              suggestedFix: `Add line connecting ${n1.name} to ${n2.name}`,
            });
            suggestions.push(`Add line from ${n1.name} to ${n2.name} (floor edge)`);
          }
        }
      }
    });
  }

  // 3d. Check wall-top/mid-level perimeter completeness
  if (midNodes.length === 4) {
    console.log('   🏗️  Analyzing wall-top rectangle...');

    // For a 4-corner wall-top, check if it forms a complete rectangle
    const sorted = [...midNodes].sort((a, b) => {
      if (Math.abs(a.z - b.z) > 0.1) return a.z - b.z;
      return a.x - b.x;
    });

    // Identify corners
    const corners = {
      frontLeft: sorted.find(n => n.x === Math.min(...midNodes.map(f => f.x)) && n.z === Math.min(...midNodes.map(f => f.z))),
      frontRight: sorted.find(n => n.x === Math.max(...midNodes.map(f => f.x)) && n.z === Math.min(...midNodes.map(f => f.z))),
      backRight: sorted.find(n => n.x === Math.max(...midNodes.map(f => f.x)) && n.z === Math.max(...midNodes.map(f => f.z))),
      backLeft: sorted.find(n => n.x === Math.min(...midNodes.map(f => f.x)) && n.z === Math.max(...midNodes.map(f => f.z))),
    };

    // Define the 4 edges of a rectangle
    const requiredEdges = [
      [corners.frontLeft, corners.frontRight, 'front edge'],
      [corners.frontRight, corners.backRight, 'right edge'],
      [corners.backRight, corners.backLeft, 'back edge'],
      [corners.backLeft, corners.frontLeft, 'left edge'],
    ];

    requiredEdges.forEach(([n1, n2, edgeName]) => {
      if (!n1 || !n2) return;

      const hasConnection = state.lines.some(line =>
        (line.node1 === n1.name && line.node2 === n2.name) ||
        (line.node2 === n1.name && line.node1 === n2.name)
      );

      if (!hasConnection) {
        errors.push({
          type: 'missing_connection',
          severity: 'critical',
          description: `Wall-top ${edgeName} missing: ${n1.name} to ${n2.name} - incomplete wall-top perimeter`,
          affectedNodes: [n1.name, n2.name],
          suggestedFix: `Add line connecting ${n1.name} to ${n2.name} (wall-top ${edgeName})`,
        });
        suggestions.push(`Add line from ${n1.name} to ${n2.name} (wall-top ${edgeName})`);
        console.log(`   ❌ Missing wall-top ${edgeName}: ${n1.name} → ${n2.name}`);
      } else {
        console.log(`   ✅ Wall-top ${edgeName}: ${n1.name} → ${n2.name}`);
      }
    });
  }

  // Step 4: Gravity-based structural analysis
  console.log('   🏗️  Analyzing structural stability (gravity)...');

  // Build adjacency graph for connectivity analysis
  const adjacency = new Map<string, Set<string>>();
  state.nodes.forEach(node => adjacency.set(node.name, new Set()));
  state.lines.forEach(line => {
    adjacency.get(line.node1)?.add(line.node2);
    adjacency.get(line.node2)?.add(line.node1);
  });

  // Find all nodes connected to ground (y=0) through any path
  const groundedNodes = new Set<string>();
  const visited = new Set<string>();

  function findGroundedNodes(nodeName: string) {
    if (visited.has(nodeName)) return;
    visited.add(nodeName);

    const node = state.nodes.find(n => n.name === nodeName);
    if (!node) return;

    // If node is on ground, mark it and all its connections as grounded
    if (Math.abs(node.y - minY) < 0.1) {
      groundedNodes.add(nodeName);
    }

    // Traverse to connected nodes
    const neighbors = adjacency.get(nodeName);
    if (neighbors) {
      neighbors.forEach(neighborName => {
        findGroundedNodes(neighborName);
      });
    }
  }

  // Start traversal from all floor nodes
  floorNodes.forEach(floorNode => {
    findGroundedNodes(floorNode.name);
  });

  // Now propagate grounding through the connected graph
  // Any node connected to a grounded node is also grounded (through structural path)
  let changed = true;
  while (changed) {
    changed = false;
    state.nodes.forEach(node => {
      if (!groundedNodes.has(node.name)) {
        const neighbors = adjacency.get(node.name);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (groundedNodes.has(neighbor)) {
              groundedNodes.add(node.name);
              changed = true;
              break;
            }
          }
        }
      }
    });
  }

  // Find floating (ungrounded) nodes
  const floatingNodes = state.nodes.filter(n => !groundedNodes.has(n.name));

  if (floatingNodes.length > 0) {
    console.log(`   ⚠️  Found ${floatingNodes.length} floating node(s) with no structural path to ground:`);
    floatingNodes.forEach(node => {
      console.log(`      ${node.name} at (${node.x}, ${node.y}, ${node.z})`);

      errors.push({
        type: 'missing_connection',
        severity: 'critical',
        description: `Node ${node.name} at (${node.x}, ${node.y}, ${node.z}) has no structural path to ground - floating structure`,
        affectedNodes: [node.name],
        suggestedFix: `Add vertical support connecting ${node.name} to a grounded node or floor`,
      });

      // Try to find nearest floor node for suggestion
      const nearestFloorNode = floorNodes.reduce((nearest, floor) => {
        const distToFloor = Math.sqrt(
          Math.pow(node.x - floor.x, 2) + Math.pow(node.z - floor.z, 2)
        );
        const distToNearest = nearest ? Math.sqrt(
          Math.pow(node.x - nearest.x, 2) + Math.pow(node.z - nearest.z, 2)
        ) : Infinity;
        return distToFloor < distToNearest ? floor : nearest;
      }, null as typeof floorNodes[0] | null);

      if (nearestFloorNode && Math.abs(node.x - nearestFloorNode.x) < 0.1 && Math.abs(node.z - nearestFloorNode.z) < 0.1) {
        // Directly above a floor node - need vertical support
        suggestions.push(`Add vertical support from ${nearestFloorNode.name} (floor) to ${node.name}`);
      }
    });
  } else {
    console.log(`   ✅ All nodes have structural path to ground`);
  }

  // Step 5: Generate summary
  const criticalErrors = errors.filter(e => e.severity === 'critical');
  const warnings = errors.filter(e => e.severity === 'warning');

  const valid = criticalErrors.length === 0;

  if (valid) {
    console.log('   ✅ Structure is logically valid');
    if (warnings.length > 0) {
      console.log(`   ⚠️  ${warnings.length} warning(s) found`);
    }
  } else {
    console.log(`   ❌ ${criticalErrors.length} critical structural error(s) found`);
  }

  // Step 6: Circuit breaker - detect infinite loops
  if (!valid) {
    const conversationId = context.conversationId || 'default';

    // Create error signature from critical errors
    const errorSignature = JSON.stringify(
      criticalErrors.slice(0, 3).map(e => ({
        type: e.type,
        affectedLines: e.affectedLines?.sort(),
        affectedNodes: e.affectedNodes?.sort()
      }))
    );

    // Track recent actions (deleted/created lines)
    const currentLines = state.lines.map(l => `${l.node1}-${l.node2}`).sort().join(',');

    const history = validationHistory.get(conversationId) || {
      count: 0,
      lastErrorSignature: '',
      lastActions: []
    };

    // Check if we're seeing the same error repeatedly
    if (history.lastErrorSignature === errorSignature) {
      history.count++;

      // Detect oscillation: repeatedly creating/deleting same lines
      if (history.lastActions.includes(currentLines)) {
        history.count += 2; // Accelerate count if we detect oscillation
        console.log(`   ⚠️  OSCILLATION DETECTED: Same line configuration repeated`);
      }
    } else {
      history.count = 1;
      history.lastErrorSignature = errorSignature;
    }

    history.lastActions.push(currentLines);
    if (history.lastActions.length > 5) {
      history.lastActions.shift(); // Keep only recent 5
    }

    validationHistory.set(conversationId, history);

    console.log(`   📊 Validation failure count: ${history.count}`);

    // Trigger circuit breaker at 3 consecutive failures
    if (history.count >= 3) {
      console.log(`   🚨 CIRCUIT BREAKER TRIGGERED after ${history.count} repeated failures!`);

      // Detect conflicting requirements
      const hasFloatingError = criticalErrors.some(e =>
        e.description.includes('no structural path to ground')
      );
      const hasIllogicalDiagonal = criticalErrors.some(e =>
        e.description.includes('illogical') && e.description.includes('diagonal')
      );

      const conflictDetected = hasFloatingError && hasIllogicalDiagonal;

      return {
        success: true,
        message: `CIRCUIT BREAKER ACTIVATED - ${history.count} repeated validation failures`,
        data: {
          valid: false,
          errors: errors.map(e => ({
            type: e.type,
            severity: e.severity,
            description: e.description,
            affectedNodes: e.affectedNodes,
            affectedLines: e.affectedLines,
            suggestedFix: e.suggestedFix,
          })),
          suggestions,
          summary: {
            totalNodes: state.nodes.length,
            totalLines: state.lines.length,
            floorNodes: floorNodes.length,
            midLevelNodes: midNodes.length,
            roofNodes: roofNodes.length,
            criticalErrors: criticalErrors.length,
            warnings: warnings.length,
          },
          circuitBreakerTriggered: true,
          repeatCount: history.count,
          conflictingRequirements: conflictDetected,
          criticalWarning: [
            `🚨 INFINITE LOOP DETECTED: Validation has failed ${history.count} times with similar errors.`,
            ``,
            conflictDetected ? `⚠️  CONFLICTING REQUIREMENTS DETECTED:` : '',
            conflictDetected ? `   - Validator says: "Don't create diagonal supports (illogical_connection)"` : '',
            conflictDetected ? `   - Validator also says: "All nodes need structural path to ground (missing_connection)"` : '',
            conflictDetected ? `   - These requirements CANNOT both be satisfied!` : '',
            conflictDetected ? `` : '',
            conflictDetected ? `💡 This suggests the structure you're creating may be a BRIDGE or CUSTOM design,` : '',
            conflictDetected ? `   not a traditional HOUSE. Diagonal supports are VALID for bridges!` : '',
            ``,
            `RECOMMENDED ACTIONS:`,
            `1. STOP retrying the same approach - you're stuck in a loop`,
            `2. Ask the user: "I'm having difficulty validating this structure. The validator is treating`,
            `   it like a house, but your bridge design needs diagonal supports. Should I:`,
            `   a) Keep the diagonal supports and ignore house-specific validation?`,
            `   b) Try a different structural approach?`,
            `   c) Skip validation for this custom design?"`,
            `3. Consider that validation rules for HOUSES don't apply to BRIDGES`,
            ``,
            `🛑 DO NOT delete and recreate the same lines again - you've tried that ${history.count} times!`,
          ].filter(Boolean),
        },
      };
    }
  } else {
    // Clear history on successful validation
    const conversationId = context.conversationId || 'default';
    validationHistory.delete(conversationId);
  }

  return {
    success: true,
    message: valid
      ? `Structure validated successfully${warnings.length > 0 ? ` (${warnings.length} warnings)` : ''}`
      : `Found ${criticalErrors.length} critical error(s) and ${warnings.length} warning(s)`,
    data: {
      valid,
      errors: errors.map(e => ({
        type: e.type,
        severity: e.severity,
        description: e.description,
        affectedNodes: e.affectedNodes,
        affectedLines: e.affectedLines,
        suggestedFix: e.suggestedFix,
      })),
      suggestions,
      summary: {
        totalNodes: state.nodes.length,
        totalLines: state.lines.length,
        floorNodes: floorNodes.length,
        midLevelNodes: midNodes.length,
        roofNodes: roofNodes.length,
        criticalErrors: criticalErrors.length,
        warnings: warnings.length,
      },
    },
  };
}
