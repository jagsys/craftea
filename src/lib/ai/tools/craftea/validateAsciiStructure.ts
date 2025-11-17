import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({
  asciiArt: z.string().describe('The ASCII art preview from the plan'),
  steps: z.array(z.string()).describe('The step descriptions with coordinates'),
  structureType: z.string().optional().describe('Type of structure: house, pyramid, letter, etc.'),
});

export const validateAsciiStructureTool = ToolSchemaBuilder
  .withName('validateAsciiStructure')
  .withDescription('Validates that plan coordinates match the ASCII art visualization')
  .withInstructions(`This tool ensures the plan will create what the ASCII art shows.

Critical checks:
1. **Y-axis layering** - Nodes should be grouped at correct heights
2. **Vertical alignment** - Features above each other should share X/Z coords
3. **Node counts** - Each visual layer should have expected number of nodes
4. **Apex positioning** - Peaks should be ABOVE their base layer

Example:
House ASCII shows base → walls → roof
Coordinates MUST have 3 Y-levels: y=0 (base), y=mid (wall-tops), y=top (apex)

⚠️ CIRCUIT BREAKER: If validation fails 3+ times with the same error, this tool will trigger a circuit breaker and provide a critical warning. If you receive a circuit breaker warning:
- STOP retrying the same approach immediately
- Read the suggestedFixes carefully - they contain EXACT coordinates to use
- If still unclear, ask the user for help rather than continuing to retry

Call this during plan review to catch coordinate mismatches before execution!`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'Validate house plan coordinates against ASCII art',
    toolInput: {
      asciiArt: '       /\\\n      /  \\\n     /____\\\n    /|    |\\\n   /__|____|__\\',
      steps: [
        'Create node N1 at (0, 0, 0) - base corner',
        'Create node N5 at (0, 2, 0) - wall top',
        'Create node N9 at (2, 3.5, 1.5) - roof apex',
      ],
      structureType: 'house',
    },
  })
  .build();

interface NodeInfo {
  name: string;
  x: number;
  y: number;
  z: number;
  description?: string;
}

/**
 * Extract coordinates from plan steps
 */
function extractNodesFromSteps(steps: string[]): NodeInfo[] {
  const nodes: NodeInfo[] = [];

  for (const step of steps) {
    // Match patterns like: "Create node N1 at (0, 0, 0) - description"
    const match = step.match(/node\s+(N\d+)\s+at\s+\(([^)]+)\)\s*(?:-\s*(.+))?/i);

    if (match) {
      const [, name, coords, description] = match;
      const [x, y, z] = coords.split(',').map(s => parseFloat(s.trim()));

      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        nodes.push({ name, x, y, z, description });
      }
    }
  }

  return nodes;
}

/**
 * Group nodes by Y-axis levels (with tolerance for floating point)
 */
function groupNodesByYLevel(nodes: NodeInfo[]): Map<number, NodeInfo[]> {
  const levels = new Map<number, NodeInfo[]>();
  const tolerance = 0.01;

  for (const node of nodes) {
    let foundLevel = false;

    // Check if this Y is close to an existing level
    for (const [level, levelNodes] of levels.entries()) {
      if (Math.abs(node.y - level) < tolerance) {
        levelNodes.push(node);
        foundLevel = true;
        break;
      }
    }

    if (!foundLevel) {
      levels.set(node.y, [node]);
    }
  }

  return levels;
}

/**
 * Validate house structure
 */
function validateHouseStructure(nodes: NodeInfo[], asciiArt: string): {
  valid: boolean;
  message: string;
  mismatches?: string[];
  suggestedFixes?: string[];
} {
  const levels = groupNodesByYLevel(nodes);
  const sortedLevels = Array.from(levels.entries()).sort((a, b) => a[0] - b[0]);

  const issues: string[] = [];
  const suggestedFixes: string[] = [];

  // House should have exactly 3 Y-levels
  if (sortedLevels.length !== 3) {
    issues.push(
      `House requires 3 Y-levels (base, wall-tops, apex), but found ${sortedLevels.length} levels`
    );
    issues.push(
      `Expected: Layer 1 (base), Layer 2 (wall-tops), Layer 3 (roof apex)`
    );
    issues.push(
      `Found Y-levels: ${sortedLevels.map(([y, nodes]) => `y=${y} (${nodes.length} nodes)`).join(', ')}`
    );

    // Provide concrete fix suggestions
    if (sortedLevels.length === 1) {
      const baseY = sortedLevels[0][0];
      const baseNodes = sortedLevels[0][1];
      suggestedFixes.push(
        `CRITICAL: You created all nodes at the same Y-level (y=${baseY}). Houses need 3 DIFFERENT heights:`
      );
      suggestedFixes.push(`  1. Base floor at y=0 (4 corner nodes)`);
      suggestedFixes.push(`  2. Wall-tops at y=2 or y=3 (4 corner nodes, SAME X/Z as base but DIFFERENT Y)`);
      suggestedFixes.push(`  3. Roof apex at y=3.5 or y=4 (1 center node)`);
      if (baseNodes.length >= 4) {
        suggestedFixes.push(``);
        suggestedFixes.push(`Example fix for your structure:`);
        baseNodes.slice(0, 4).forEach((node, i) => {
          suggestedFixes.push(`  - Keep ${node.name} at (${node.x}, 0, ${node.z}) for base`);
          suggestedFixes.push(`  - Create N${5+i} at (${node.x}, 3, ${node.z}) for wall-top ABOVE ${node.name}`);
        });
        suggestedFixes.push(`  - Create N9 at center position with y=4 for roof apex`);
      }
    } else if (sortedLevels.length === 2) {
      suggestedFixes.push(`You have 2 Y-levels but need 3. Add the missing level (likely wall-tops or apex)`);
    }
  }

  // Level 0 (base) should have 4 nodes
  if (sortedLevels.length > 0) {
    const baseLevel = sortedLevels[0];
    if (baseLevel[1].length !== 4) {
      issues.push(
        `Base layer should have 4 corner nodes, found ${baseLevel[1].length} nodes at y=${baseLevel[0]}`
      );
      if (baseLevel[1].length > 4) {
        suggestedFixes.push(
          `Too many nodes at base level (y=${baseLevel[0]}). You may have duplicate nodes or wall-top nodes at wrong Y-level.`
        );
        suggestedFixes.push(`Base nodes found: ${baseLevel[1].map(n => n.name).join(', ')}`);
        suggestedFixes.push(`Make sure wall-top nodes (N5-N8) are at a HIGHER Y value like y=3, not y=${baseLevel[0]}`);
      }
    }
  }

  // Level 1 (wall-tops) should have 4 nodes
  if (sortedLevels.length > 1) {
    const wallLevel = sortedLevels[1];
    if (wallLevel[1].length !== 4) {
      issues.push(
        `Wall-top layer should have 4 corner nodes, found ${wallLevel[1].length} nodes at y=${wallLevel[0]}`
      );
      if (wallLevel[1].length < 4 && sortedLevels[0]) {
        const baseNodes = sortedLevels[0][1];
        suggestedFixes.push(
          `Missing wall-top nodes. Each base corner needs a corresponding wall-top node directly above it.`
        );
        baseNodes.forEach((baseNode, i) => {
          suggestedFixes.push(
            `  Create N${5+i} at (${baseNode.x}, ${wallLevel[0] || 3}, ${baseNode.z}) - wall-top above ${baseNode.name}`
          );
        });
      }
    }
  }

  // Level 2 (apex) should have 1 node
  if (sortedLevels.length > 2) {
    const apexLevel = sortedLevels[2];
    if (apexLevel[1].length !== 1) {
      issues.push(
        `Roof apex should be 1 node at top, found ${apexLevel[1].length} nodes at y=${apexLevel[0]}`
      );
      if (apexLevel[1].length > 1) {
        suggestedFixes.push(`Roof should have single apex node at the top, not ${apexLevel[1].length} nodes`);
      }
    }
  }

  // Check vertical alignment: base and wall-tops should align in X/Z
  if (sortedLevels.length >= 2) {
    const baseNodes = sortedLevels[0][1];
    const wallNodes = sortedLevels[1][1];

    // Base and wall corners should have matching X/Z coordinates
    const baseXZ = baseNodes.map(n => `${n.x},${n.z}`).sort();
    const wallXZ = wallNodes.map(n => `${n.x},${n.z}`).sort();

    if (JSON.stringify(baseXZ) !== JSON.stringify(wallXZ)) {
      issues.push(
        `Walls should be directly above base (same X/Z coordinates), but positions don't match`
      );
      issues.push(`Base X/Z: ${baseXZ.join(' | ')}`);
      issues.push(`Wall X/Z: ${wallXZ.join(' | ')}`);

      suggestedFixes.push(`Wall-top nodes must have SAME X and Z as base, only Y should be different:`);
      baseNodes.forEach((baseNode, i) => {
        suggestedFixes.push(
          `  ${baseNode.name} at (${baseNode.x}, ${sortedLevels[0][0]}, ${baseNode.z}) → N${5+i} at (${baseNode.x}, ${sortedLevels[1][0]}, ${baseNode.z})`
        );
      });
    }
  }

  // Check apex centering (should be at center of base/walls in X/Z)
  if (sortedLevels.length === 3 && sortedLevels[0][1].length === 4) {
    const baseNodes = sortedLevels[0][1];
    const apex = sortedLevels[2][1][0];

    const avgX = baseNodes.reduce((sum, n) => sum + n.x, 0) / baseNodes.length;
    const avgZ = baseNodes.reduce((sum, n) => sum + n.z, 0) / baseNodes.length;

    if (Math.abs(apex.x - avgX) > 0.5 || Math.abs(apex.z - avgZ) > 0.5) {
      issues.push(
        `Roof apex should be centered above base, but is at (${apex.x}, ${apex.z}) vs center (${avgX}, ${avgZ})`
      );
      suggestedFixes.push(
        `Move apex node to center: (${avgX}, ${sortedLevels[2][0]}, ${avgZ})`
      );
    }
  }

  if (issues.length === 0) {
    return {
      valid: true,
      message: 'House structure validation passed',
    };
  }

  return {
    valid: false,
    message: 'House coordinates do not match expected structure',
    mismatches: issues,
    suggestedFixes: suggestedFixes.length > 0 ? suggestedFixes : undefined,
  };
}

/**
 * Validate pyramid structure
 */
function validatePyramidStructure(nodes: NodeInfo[]): {
  valid: boolean;
  message: string;
  mismatches?: string[];
} {
  const levels = groupNodesByYLevel(nodes);
  const sortedLevels = Array.from(levels.entries()).sort((a, b) => a[0] - b[0]);

  const issues: string[] = [];

  // Pyramid should have exactly 2 Y-levels
  if (sortedLevels.length !== 2) {
    issues.push(`Pyramid requires 2 Y-levels (base, apex), found ${sortedLevels.length}`);
  }

  // Base should have 4 nodes
  if (sortedLevels.length > 0 && sortedLevels[0][1].length !== 4) {
    issues.push(`Base should have 4 corners, found ${sortedLevels[0][1].length}`);
  }

  // Apex should have 1 node
  if (sortedLevels.length > 1 && sortedLevels[1][1].length !== 1) {
    issues.push(`Apex should be 1 node, found ${sortedLevels[1][1].length}`);
  }

  return {
    valid: issues.length === 0,
    message: issues.length === 0 ? 'Pyramid structure valid' : 'Pyramid structure invalid',
    mismatches: issues.length > 0 ? issues : undefined,
  };
}

// Track validation attempts to detect infinite loops
const validationHistory = new Map<string, { count: number; lastError: string }>();

export async function executeValidateAsciiStructure(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { asciiArt, steps, structureType } = input;

  console.log('   🎨 [ASCII VALIDATOR] Analyzing structure...');

  // Extract nodes from steps
  const nodes = extractNodesFromSteps(steps);

  if (nodes.length === 0) {
    return {
      success: false,
      message: 'Could not extract node coordinates from steps',
      data: {},
    };
  }

  console.log(`   📊 Found ${nodes.length} nodes to validate`);

  // Determine structure type from ASCII art or explicit type
  let detectedType = structureType?.toLowerCase() || '';

  if (!detectedType) {
    if (asciiArt.includes('/\\') && asciiArt.includes('|')) {
      detectedType = 'house';
    } else if (asciiArt.includes('/\\') && !asciiArt.includes('|')) {
      detectedType = 'pyramid';
    }
  }

  console.log(`   🏗️  Structure type: ${detectedType || 'unknown'}`);

  // Validate based on structure type
  let validation;

  if (detectedType === 'house') {
    validation = validateHouseStructure(nodes, asciiArt);
  } else if (detectedType === 'pyramid') {
    validation = validatePyramidStructure(nodes);
  } else {
    // Generic validation - just report the structure
    const levels = groupNodesByYLevel(nodes);
    const sortedLevels = Array.from(levels.entries()).sort((a, b) => a[0] - b[0]);

    return {
      success: true,
      message: 'Generic structure analysis (no specific validation rules)',
      data: {
        valid: true,
        nodeCount: nodes.length,
        yLevels: sortedLevels.map(([y, levelNodes]) => ({
          y,
          count: levelNodes.length,
          nodes: levelNodes.map(n => n.name),
        })),
      },
    };
  }

  if (!validation.valid) {
    console.log('   ❌ Validation FAILED');
    console.log('   Issues:', validation.mismatches);

    // Circuit breaker: detect repeated failures
    const errorSignature = JSON.stringify(validation.mismatches?.slice(0, 2) || []);
    const conversationId = context.conversationId || 'default';

    const history = validationHistory.get(conversationId) || { count: 0, lastError: '' };

    if (history.lastError === errorSignature) {
      history.count++;
    } else {
      history.count = 1;
      history.lastError = errorSignature;
    }

    validationHistory.set(conversationId, history);

    // If same error repeated 3+ times, warn about infinite loop
    if (history.count >= 3) {
      console.log(`   ⚠️  WARNING: Same validation error repeated ${history.count} times - possible infinite loop!`);

      return {
        success: true,
        message: `REPEATED VALIDATION FAILURE (${history.count} times) - Circuit breaker activated`,
        data: {
          valid: false,
          mismatches: validation.mismatches,
          suggestedFixes: validation.suggestedFixes,
          nodeCount: nodes.length,
          structureType: detectedType,
          circuitBreakerTriggered: true,
          repeatCount: history.count,
          criticalWarning: [
            `🚨 INFINITE LOOP DETECTED: This validation has failed ${history.count} times with the same error.`,
            ``,
            `The AI agent appears to be stuck in a loop, creating the same incorrect plan repeatedly.`,
            ``,
            `RECOMMENDED ACTIONS:`,
            `1. STOP retrying the same approach`,
            `2. Ask the user for clarification or simplification of the request`,
            `3. Try a completely different approach to the problem`,
            `4. Consider if this structure type is too complex and needs to be broken down`,
            ``,
            `If you are an AI agent seeing this message, DO NOT retry the same plan again.`,
            `Instead, ask the user: "I'm having trouble creating this structure. Could you help me understand what's going wrong, or would you like to try a simpler design first?"`,
          ],
        },
      };
    }
  } else {
    console.log('   ✅ Validation PASSED');
    // Clear history on success
    validationHistory.delete(context.conversationId || 'default');
  }

  return {
    success: true,
    message: validation.message,
    data: {
      valid: validation.valid,
      mismatches: validation.mismatches,
      suggestedFixes: validation.suggestedFixes,
      nodeCount: nodes.length,
      structureType: detectedType,
    },
  };
}
