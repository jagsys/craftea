import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({
  plan: z.object({
    summary: z.string(),
    steps: z.array(z.string()),
  }),
  stateBefore: z.object({
    nodeCount: z.number(),
    lineCount: z.number(),
  }),
});

export const validateExecutionTool = ToolSchemaBuilder
  .withName('validateExecution')
  .withDescription('Validates that the executed structure matches the approved plan')
  .withInstructions(`Call this AFTER executing a plan to ensure what was created matches what was planned.

Critical checks:
1. **Node count** - Did we create the expected number of nodes?
2. **Line count** - Did we create the expected number of lines?
3. **Node names** - Are all planned nodes present?
4. **Line connections** - Do lines connect the correct nodes?
5. **Orphaned nodes** - Are there any nodes with no connections?

Example:
Plan: "Create 9 nodes N1-N9 and 12 lines"
Actual: 10 nodes, 12 lines → MISMATCH! (extra node N10)

This catches execution errors before the user sees the wrong structure!`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'Validate that house execution matches plan',
    toolInput: {
      plan: {
        summary: 'Create house with 9 nodes and 12 lines',
        steps: ['Create node N1...', 'Create line L1...'],
      },
      stateBefore: {
        nodeCount: 0,
        lineCount: 0,
      },
    },
  })
  .build();

/**
 * Extract expected nodes from plan steps
 */
function extractExpectedNodes(steps: string[]): string[] {
  const nodes = new Set<string>();

  for (const step of steps) {
    const match = step.match(/node\s+(N\d+)/i);
    if (match) {
      nodes.add(match[1]);
    }
  }

  return Array.from(nodes).sort((a, b) => {
    const aNum = parseInt(a.substring(1));
    const bNum = parseInt(b.substring(1));
    return aNum - bNum;
  });
}

/**
 * Extract expected lines from plan steps
 */
function extractExpectedLines(steps: string[]): Array<{ name: string; node1: string; node2: string }> {
  const lines: Array<{ name: string; node1: string; node2: string }> = [];

  for (const step of steps) {
    // Match patterns like: "Create line L1 connecting N1 to N2" or "Create line L1 from N1 to N2"
    const match = step.match(/line\s+(L\d+).*(?:connecting|from)\s+(N\d+)\s+(?:to|and)\s+(N\d+)/i);
    if (match) {
      const [, name, node1, node2] = match;
      lines.push({ name, node1, node2 });
    }
  }

  return lines;
}

/**
 * Find orphaned nodes (nodes with no line connections)
 */
function findOrphanedNodes(context: ToolContext): string[] {
  const { state } = context;
  const connectedNodes = new Set<string>();

  // Collect all nodes that have at least one line connection
  for (const line of state.lines) {
    connectedNodes.add(line.node1);
    connectedNodes.add(line.node2);
  }

  // Find nodes that have no connections
  const orphanedNodes: string[] = [];
  for (const node of state.nodes) {
    if (!connectedNodes.has(node.name)) {
      orphanedNodes.push(node.name);
    }
  }

  return orphanedNodes;
}

export async function executeValidateExecution(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { plan, stateBefore } = input;
  const { state } = context;

  console.log('   🔍 [EXECUTION VALIDATOR] Validating execution against plan...');

  const issues: string[] = [];

  // Extract expected structure from plan
  const expectedNodes = extractExpectedNodes(plan.steps);
  const expectedLines = extractExpectedLines(plan.steps);

  // Calculate actual changes
  const actualNewNodes = state.nodes.length - stateBefore.nodeCount;
  const actualNewLines = state.lines.length - stateBefore.lineCount;

  console.log(`   📊 Expected: ${expectedNodes.length} nodes, ${expectedLines.length} lines`);
  console.log(`   📊 Actual: ${actualNewNodes} new nodes, ${actualNewLines} new lines`);

  // Validate node count
  if (actualNewNodes !== expectedNodes.length) {
    issues.push(
      `❌ Node count mismatch: Plan expected ${expectedNodes.length} nodes, but ${actualNewNodes} were created`
    );
    issues.push(`   Expected nodes: ${expectedNodes.join(', ')}`);

    // Find extra or missing nodes
    const actualNodeNames = state.nodes.slice(stateBefore.nodeCount).map(n => n.name);
    const extraNodes = actualNodeNames.filter(n => !expectedNodes.includes(n));
    const missingNodes = expectedNodes.filter(n => !actualNodeNames.includes(n));

    if (extraNodes.length > 0) {
      issues.push(`   Extra nodes created: ${extraNodes.join(', ')}`);
    }
    if (missingNodes.length > 0) {
      issues.push(`   Missing nodes: ${missingNodes.join(', ')}`);
    }
  }

  // Validate line count
  if (actualNewLines !== expectedLines.length) {
    issues.push(
      `❌ Line count mismatch: Plan expected ${expectedLines.length} lines, but ${actualNewLines} were created`
    );
  }

  // Check for orphaned nodes
  const orphanedNodes = findOrphanedNodes(context);
  if (orphanedNodes.length > 0) {
    issues.push(
      `❌ Orphaned nodes detected: ${orphanedNodes.join(', ')} have no line connections!`
    );
    issues.push(
      `   These nodes are isolated and not part of the structure.`
    );
  }

  // Validate line connections match plan
  const actualLineConnections = state.lines.slice(stateBefore.lineCount);
  const mismatchedLines: string[] = [];

  for (const expectedLine of expectedLines) {
    const actualLine = actualLineConnections.find(l => l.name === expectedLine.name);

    if (!actualLine) {
      mismatchedLines.push(`${expectedLine.name} is missing`);
    } else {
      // Check if connections match (order doesn't matter)
      const expectedConn = [expectedLine.node1, expectedLine.node2].sort();
      const actualConn = [actualLine.node1, actualLine.node2].sort();

      if (expectedConn[0] !== actualConn[0] || expectedConn[1] !== actualConn[1]) {
        mismatchedLines.push(
          `${expectedLine.name}: Expected ${expectedLine.node1}-${expectedLine.node2}, got ${actualLine.node1}-${actualLine.node2}`
        );
      }
    }
  }

  if (mismatchedLines.length > 0) {
    issues.push(`❌ Line connection mismatches:`);
    mismatchedLines.forEach(msg => issues.push(`   ${msg}`));
  }

  // Determine if validation passed
  const valid = issues.length === 0;

  if (valid) {
    console.log('   ✅ Execution matches plan perfectly!');
    return {
      success: true,
      message: 'Execution validated successfully',
      data: {
        valid: true,
        nodesCreated: actualNewNodes,
        linesCreated: actualNewLines,
      },
    };
  } else {
    console.log('   ❌ Execution does NOT match plan!');
    console.log('   Issues:', issues);

    return {
      success: false,
      message: 'Execution does not match approved plan',
      data: {
        valid: false,
        issues,
        expectedNodes: expectedNodes.length,
        actualNodes: actualNewNodes,
        expectedLines: expectedLines.length,
        actualLines: actualNewLines,
        orphanedNodes,
      },
    };
  }
}
