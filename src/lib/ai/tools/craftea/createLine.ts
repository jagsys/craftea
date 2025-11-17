import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({
  node1: z.string().describe('Name of the first node (e.g., N1, Base)'),
  node2: z.string().describe('Name of the second node (e.g., N2, Top)'),
  name: z.string().optional().describe('Optional custom name for the line (e.g., L1, BeamA). If not provided, will auto-generate.'),
});

export const createLineTool = ToolSchemaBuilder
  .withName('createLine')
  .withDescription('Creates a line connecting two existing nodes')
  .withInstructions(`Use this tool to connect two nodes with a line.
The tool will verify that both nodes exist and that they are different.
If you provide a name that already exists, the system will automatically generate a unique name.
You can omit the name parameter to always auto-generate names (L1, L2, L3, etc.).`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'Connect N1 to N2',
    toolInput: { node1: 'N1', node2: 'N2' },
  })
  .addExample({
    userInput: 'Draw a line from Base to Top called Beam1',
    toolInput: { node1: 'Base', node2: 'Top', name: 'Beam1' },
  })
  .build();

export async function executeCreateLine(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { node1, node2, name } = input;
  const { state } = context;

  // Check if nodes are the same
  if (node1 === node2) {
    return {
      success: false,
      message: `Cannot create a line from a node to itself (${node1}).`,
    };
  }

  // Check if both nodes exist
  const n1 = state.nodes.find(n => n.name === node1);
  const n2 = state.nodes.find(n => n.name === node2);

  if (!n1) {
    return {
      success: false,
      message: `Node ${node1} does not exist. Create it first.`,
    };
  }

  if (!n2) {
    return {
      success: false,
      message: `Node ${node2} does not exist. Create it first.`,
    };
  }

  // Check if line already exists between these nodes
  const existingLine = state.lines.find(
    l => (l.node1 === node1 && l.node2 === node2) || (l.node1 === node2 && l.node2 === node1)
  );

  if (existingLine) {
    return {
      success: false,
      message: `Line ${existingLine.name} already connects ${node1} and ${node2}.`,
    };
  }

  // Auto-generate name if not provided OR if the provided name already exists
  let lineName = name;

  // If name is provided but already exists, auto-generate instead
  if (lineName && state.lines.some(l => l.name === lineName)) {
    console.log(`   ⚠️  Line name ${lineName} already exists, auto-generating new name...`);
    lineName = undefined; // Force auto-generation
  }

  // Auto-generate name if needed
  if (!lineName) {
    let counter = 1;
    while (state.lines.some(l => l.name === `L${counter}`)) {
      counter++;
    }
    lineName = `L${counter}`;
    console.log(`   🔢 Auto-generated line name: ${lineName}`);
  }

  // Calculate distance
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const dz = n2.z - n1.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Create the line and ADD IT TO STATE
  const newLine = { name: lineName, node1, node2 };
  state.lines.push(newLine);

  console.log(`   ✨ Line ${lineName} added to state. Total lines: ${state.lines.length}`);

  return {
    success: true,
    message: `Created line ${lineName} connecting ${node1} to ${node2} (${distance.toFixed(2)}m)`,
    data: {
      line: newLine,
    },
  };
}
