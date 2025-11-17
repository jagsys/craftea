import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({
  plan: z.object({
    asciiPreview: z.string().optional(),
    summary: z.string(),
    steps: z.array(z.string()),
  }),
  userRequest: z.string().describe('The original user request'),
});

export const reviewPlanTool = ToolSchemaBuilder
  .withName('reviewPlan')
  .withDescription('Validates a plan for geometric correctness and structural logic before showing it to the user')
  .withInstructions(`This tool reviews a plan to check if it makes geometric and structural sense.

CRITICAL VALIDATION CHECKS:
1. **Ceiling/Roof Structures**: Should connect to TOP nodes (highest Y values), NOT bottom nodes
2. **Floor Structures**: Should connect to BOTTOM nodes (lowest Y values), NOT top nodes
3. **Walls**: Should connect vertical nodes at same X,Z but different Y
4. **Node References**: All referenced nodes must exist
5. **Geometric Logic**: Coordinates should make sense for the intended structure

Common Errors to Catch:
- "Add ceiling" but connects to floor corners (y=0) instead of top corners (y=max)
- "Add base" but connects to roof corners
- Pyramid/roof apex below the base
- Connecting non-adjacent nodes for walls

Return:
- approved: true if plan is geometrically correct
- approved: false if plan has issues
- feedback: Detailed explanation of what's wrong and how to fix it
- needsUserInput: true if you need to ask the user clarifying questions
- questions: Array of questions to ask the user`)
  .withInputSchema(inputSchema)
  .build();

export async function executeReviewPlan(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { plan, userRequest } = input;
  const { state } = context;

  console.log('   🔍 Reviewing plan for geometric correctness...');
  console.log('   User request:', userRequest);
  console.log('   Plan summary:', plan.summary);
  console.log('   2D Mode:', state.is2DMode ? 'ENABLED (Z must = 0)' : 'disabled');

  // Analysis results
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check if plan steps are too vague (should have specific coordinates)
  const hasVagueSteps = plan.steps.some(step => {
    const lowerStep = step.toLowerCase();
    // Vague patterns like "create nodes for letter X" or "create lines for letter Y"
    return (
      (lowerStep.includes('create nodes for') && !lowerStep.match(/\(\s*-?\d+\.?\d*\s*,\s*-?\d+\.?\d*\s*,\s*-?\d+\.?\d*\s*\)/)) ||
      (lowerStep.includes('create lines for') && !lowerStep.match(/n\d+/i))
    );
  });

  if (hasVagueSteps) {
    issues.push(
      `⚠️ VAGUE PLAN: Steps must specify EXACT coordinates and node names, not just "create nodes for letter X".`
    );
    issues.push(
      `✓ CORRECTION: Each step should say "Create node N1 at (x, y, z)" with specific coordinates.`
    );
    issues.push(
      `✓ Example good step: "Create node N1 at (0, 0, 0) - bottom-left of H"`
    );
    issues.push(
      `✓ Example bad step: "Create nodes for letter H" (too vague!)`
    );
  }

  // Check 2D mode constraints
  if (state.is2DMode) {
    console.log('   📐 2D Mode is ACTIVE - checking for Z=0 constraint...');

    // Look for any Z coordinates in the plan text
    const coordinateMatches = plan.steps.join(' ').match(/\(([^)]+)\)/g) || [];

    for (const match of coordinateMatches) {
      // Parse coordinates like (x, y, z)
      const coords = match
        .replace(/[()]/g, '')
        .split(',')
        .map(s => s.trim());

      if (coords.length === 3) {
        const z = parseFloat(coords[2]);
        if (!isNaN(z) && z !== 0) {
          issues.push(
            `⚠️ 2D MODE VIOLATION: Found Z=${z} in coordinates ${match}. In 2D mode, ALL Z coordinates MUST be 0!`
          );
          issues.push(
            `✓ CORRECTION: Change all Z coordinates to 0 for flat 2D structures.`
          );
        }
      }
    }

    if (issues.length === 0) {
      console.log('   ✅ 2D Mode check passed - all coordinates appear to use Z=0');
    }
  }

  // Get Y-axis statistics
  const yValues = state.nodes.map(n => n.y);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  console.log(`   📊 Scene Y-axis range: ${minY} to ${maxY}`);

  // Analyze the plan text for potential issues
  const planText = `${plan.summary} ${plan.steps.join(' ')}`.toLowerCase();
  const lowerRequest = userRequest.toLowerCase();

  // Define minimum requirements for common letters (used by both word and single-letter checks)
  const letterRequirements: { [key: string]: { minNodes: number; structure: string } } = {
    'A': { minNodes: 5, structure: 'Two diagonals meeting at top apex + crossbar (needs 5 nodes: bottom-left, bottom-right, top apex, 2 crossbar nodes)' },
    'E': { minNodes: 6, structure: 'Vertical stroke + three horizontal arms (needs 6 nodes: bottom-left, top-left, bottom-right, middle-left, middle-right, top-right)' },
    'H': { minNodes: 6, structure: 'Two verticals with horizontal crossbar (needs 6 nodes: 4 for verticals + 2 for crossbar endpoints)' },
    'I': { minNodes: 2, structure: 'Single vertical line (needs 2 nodes: top, bottom)' },
    'K': { minNodes: 5, structure: 'Vertical stroke + two diagonals from middle (needs 5 nodes: bottom, middle, top, upper-right, lower-right)' },
    'L': { minNodes: 3, structure: 'Vertical + horizontal base (needs 3 nodes: top, bottom, right)' },
    'M': { minNodes: 5, structure: 'Two verticals with V-shaped valley (needs 5 nodes: bottom-left, top-left, middle valley, top-right, bottom-right)' },
    'N': { minNodes: 4, structure: 'Two verticals connected by diagonal (needs 4 nodes: bottom-left, top-left, bottom-right, top-right)' },
    'O': { minNodes: 4, structure: 'Closed rectangle (needs 4 nodes: bottom-left, bottom-right, top-right, top-left forming a loop)' },
    'T': { minNodes: 4, structure: 'Horizontal top bar + vertical stem (needs 4 nodes: top-left, top-right, middle-top, bottom)' },
    'V': { minNodes: 3, structure: 'Two diagonals meeting at bottom (needs 3 nodes: top-left, bottom apex, top-right)' },
    'W': { minNodes: 5, structure: 'Inverted M with two valleys (needs 5 nodes: top-left, bottom-left valley, middle peak, bottom-right valley, top-right)' },
    'X': { minNodes: 5, structure: 'Two diagonals crossing (needs 5 nodes: top-left, top-right, bottom-left, bottom-right, center intersection)' },
    'Y': { minNodes: 4, structure: 'Two upper diagonals meeting, one lower vertical (needs 4 nodes: top-left, top-right, middle junction, bottom)' },
  };

  // Check if user is requesting multiple letters (a word)
  const wordMatch = lowerRequest.match(/word\s+([a-z]+)|draw\s+(?:the\s+word\s+)?([a-z]{2,})/i);
  if (wordMatch) {
    const word = (wordMatch[1] || wordMatch[2]).toUpperCase();
    console.log(`   📝 Detected word request: ${word} (${word.length} letters)`);

    // Check if coordinates are properly spaced for multiple letters
    const coordinateMatches = plan.steps.join(' ').match(/\(([^)]+)\)/g) || [];
    const xCoordinates: number[] = [];

    for (const match of coordinateMatches) {
      const coords = match.replace(/[()]/g, '').split(',').map(s => parseFloat(s.trim()));
      if (coords.length === 3 && !isNaN(coords[0])) {
        xCoordinates.push(coords[0]);
      }
    }

    // Check if there's variety in X coordinates (letters should be spaced horizontally)
    const uniqueX = [...new Set(xCoordinates)].sort((a, b) => a - b);

    if (uniqueX.length < word.length) {
      warnings.push(
        `⚠️ SPACING WARNING: Word "${word}" has ${word.length} letters but only ${uniqueX.length} unique X positions.`
      );
      warnings.push(
        `✓ Letters should be horizontally spaced. Example: H at x=0-1, E at x=2-3, L at x=4-5, etc.`
      );
    }

    // Estimate minimum nodes needed for the word
    let minNodesEstimate = 0;
    for (const char of word) {
      const req = letterRequirements[char];
      minNodesEstimate += req ? req.minNodes : 4; // Default 4 if letter not in dictionary
    }

    const nodeCountMatch = planText.match(/(\d+)\s+nodes?/);
    const nodeCount = nodeCountMatch ? parseInt(nodeCountMatch[1]) : 0;

    if (nodeCount > 0 && nodeCount < minNodesEstimate * 0.8) {
      warnings.push(
        `⚠️ NODE COUNT: Word "${word}" should have approximately ${minNodesEstimate} nodes, but plan only has ${nodeCount}.`
      );
    }
  }

  // Check if user is requesting a single letter and validate structure
  const letterMatch = lowerRequest.match(/letter\s+([a-z])|draw\s+(?:a|an)\s+([a-z])\b/i);
  if (letterMatch && !wordMatch) {
    const letter = (letterMatch[1] || letterMatch[2]).toUpperCase();
    console.log(`   🔤 Detected letter request: ${letter}`);

    // Count nodes mentioned in the plan
    const nodeCountMatch = planText.match(/(\d+)\s+nodes?/);
    const nodeCount = nodeCountMatch ? parseInt(nodeCountMatch[1]) : 0;

    const requirement = letterRequirements[letter];
    if (requirement && nodeCount > 0 && nodeCount < requirement.minNodes) {
      issues.push(
        `⚠️ STRUCTURE ERROR: Letter '${letter}' requires at least ${requirement.minNodes} nodes, but plan only has ${nodeCount}.`
      );
      issues.push(
        `✓ CORRECTION: ${requirement.structure}`
      );

      // Add specific ASCII examples for common letters
      if (letter === 'M') {
        issues.push(`✓ ASCII art should show:  |\\  /|  | \\/ |  |    |`);
      } else if (letter === 'K') {
        issues.push(`✓ ASCII art should show:  |  /  | /   |<    | \\   |  \\`);
      } else if (letter === 'A') {
        issues.push(`✓ ASCII art should show:    /\\    /  \\   /----\\  /      \\`);
      }
    }

    // Validate connection patterns for specific letters
    if (letter === 'K') {
      // Check that both diagonals connect to the MIDDLE node, not top
      const stepsText = plan.steps.join(' ').toLowerCase();

      // Look for patterns like "from N2 to N4" where N2 is the top node
      // K structure: vertical should be segmented at middle, both diagonals from middle
      if (stepsText.includes('n1 to n2') && stepsText.includes('n2 to n4')) {
        // If there's a line from bottom (N1) to top (N2), and ALSO from top (N2) to diagonal
        // This means the upper diagonal connects to top instead of middle - WRONG!
        issues.push(
          `⚠️ CONNECTION ERROR: Letter K's upper diagonal should connect to the MIDDLE node, not the top.`
        );
        issues.push(
          `✓ CORRECTION: Both diagonals must meet at the middle junction point (e.g., N3 at y=1).`
        );
        issues.push(
          `✓ Vertical should be split: bottom→middle and middle→top. Both diagonals from middle.`
        );
      }
    }

    // General warning for letters with suspiciously low node counts
    if (nodeCount > 0 && nodeCount <= 3 && !['I', 'L', 'V'].includes(letter)) {
      warnings.push(
        `⚠️ Only ${nodeCount} nodes for letter '${letter}' - most letters need at least 4-5 nodes for proper structure.`
      );
    }

    // Check if ASCII preview exists
    if (!plan.asciiPreview || plan.asciiPreview.trim().length < 10) {
      warnings.push(
        `⚠️ ASCII preview seems incomplete or missing. A clear visual helps validate the structure.`
      );
    }
  }

  // Check for ceiling/roof issues
  if (lowerRequest.includes('ceiling') || lowerRequest.includes('roof') ||
      planText.includes('ceiling') || planText.includes('roof') || planText.includes('pyramid')) {

    console.log('   🏠 Detected ceiling/roof structure request');

    // Look for node references in the plan
    const nodeMatches = plan.steps.join(' ').match(/N\d+/g) || [];
    const referencedNodes = [...new Set(nodeMatches)];

    console.log('   Referenced nodes:', referencedNodes);

    // Check if any referenced nodes are at the bottom (minY)
    const bottomNodes = referencedNodes.filter(nodeName => {
      const node = state.nodes.find(n => n.name === nodeName);
      return node && node.y === minY;
    });

    if (bottomNodes.length > 0) {
      issues.push(
        `⚠️ GEOMETRIC ERROR: Plan references bottom nodes ${bottomNodes.join(', ')} (y=${minY}) for a ceiling/roof structure.`
      );
      issues.push(
        `✓ CORRECTION: For ceiling/roof, should connect to TOP nodes at y=${maxY}.`
      );

      // Find top nodes
      const topNodes = state.nodes
        .filter(n => n.y === maxY)
        .map(n => n.name)
        .sort();

      if (topNodes.length > 0) {
        issues.push(
          `✓ Available top nodes: ${topNodes.join(', ')}`
        );
      }
    }

    // Check if apex is above the base
    const apexMatches = planText.match(/apex.*\(([^)]+)\)/);
    if (apexMatches) {
      const coords = apexMatches[1].split(',').map(s => parseFloat(s.trim()));
      if (coords.length === 3) {
        const apexY = coords[1];
        if (apexY <= maxY) {
          warnings.push(
            `⚠️ Pyramid apex Y=${apexY} should be higher than the base at Y=${maxY}`
          );
        }
      }
    }
  }

  // Check for floor/base issues
  if (lowerRequest.includes('floor') || lowerRequest.includes('base') || lowerRequest.includes('foundation')) {
    console.log('   🏗️ Detected floor/base structure request');

    const nodeMatches = plan.steps.join(' ').match(/N\d+/g) || [];
    const referencedNodes = [...new Set(nodeMatches)];

    const topNodes = referencedNodes.filter(nodeName => {
      const node = state.nodes.find(n => n.name === nodeName);
      return node && node.y === maxY;
    });

    if (topNodes.length > 0) {
      issues.push(
        `⚠️ GEOMETRIC ERROR: Plan references top nodes ${topNodes.join(', ')} (y=${maxY}) for a floor/base structure.`
      );
      issues.push(
        `✓ CORRECTION: For floor/base, should connect to BOTTOM nodes at y=${minY}.`
      );
    }
  }

  // Check for house structure requirements
  if (lowerRequest.includes('house') || lowerRequest.includes('building')) {
    console.log('   🏠 Detected house/building structure request');

    // Extract Y coordinates from the plan
    const coordinateMatches = plan.steps.join(' ').match(/\(([^)]+)\)/g) || [];
    const yCoordinates: number[] = [];

    for (const match of coordinateMatches) {
      const coords = match
        .replace(/[()]/g, '')
        .split(',')
        .map(s => s.trim());

      if (coords.length === 3) {
        const y = parseFloat(coords[1]);
        if (!isNaN(y)) {
          yCoordinates.push(y);
        }
      }
    }

    // Get unique Y levels, sorted
    const uniqueYLevels = [...new Set(yCoordinates)].sort((a, b) => a - b);
    console.log('   📏 Y-levels in plan:', uniqueYLevels);

    // A house MUST have at least 3 Y-levels: floor, wall-tops, roof
    if (uniqueYLevels.length < 3) {
      issues.push(
        `⚠️ HOUSE STRUCTURE ERROR: A house requires at least 3 vertical levels (floor, wall-tops, roof).`
      );
      issues.push(
        `   Current plan only has ${uniqueYLevels.length} Y-level(s): ${uniqueYLevels.join(', ')}`
      );
      issues.push(
        `✓ CORRECTION: Create a proper house with:`
      );
      issues.push(
        `   - Floor nodes at y=0`
      );
      issues.push(
        `   - Wall-top nodes at y=3 (or mid-height)`
      );
      issues.push(
        `   - Roof apex at y=4+ (above walls)`
      );
      issues.push(
        `✓ Example: Floor corners (0,0,0), (4,0,0), (4,0,3), (0,0,3) → Wall-tops (0,3,0), (4,3,0), (4,3,3), (0,3,3) → Roof apex (2,4,1.5)`
      );
    } else {
      console.log(`   ✅ House has ${uniqueYLevels.length} Y-levels (sufficient for walls)`);
    }
  }

  // Determine if approved
  const approved = issues.length === 0;

  if (approved) {
    console.log('   ✅ Plan approved - no geometric issues found');
    if (warnings.length > 0) {
      console.log('   ⚠️ Warnings:', warnings);
    }
    return {
      success: true,
      message: 'Plan reviewed and approved',
      data: {
        approved: true,
        plan,
        warnings,
      },
    };
  } else {
    console.log('   ❌ Plan has geometric issues:', issues);
    return {
      success: true,
      message: 'Plan needs revision',
      data: {
        approved: false,
        issues,
        feedback: issues.join('\n'),
        originalPlan: plan,
      },
    };
  }
}
