import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({
  x: z.number().describe('The X coordinate of the node'),
  y: z.number().describe('The Y coordinate of the node'),
  z: z.number().describe('The Z coordinate of the node'),
  name: z.string().optional().describe('Optional custom name for the node (e.g., N1, NodeA). If not provided, will auto-generate.'),
});

export const createNodeTool = ToolSchemaBuilder
  .withName('createNode')
  .withDescription('Creates a new 3D node at the specified coordinates')
  .withInstructions(`Use this tool to create nodes in 3D space. Coordinates are in meters.
If you provide a name that already exists, the system will automatically generate a unique name.
You can omit the name parameter to always auto-generate names (N1, N2, N3, etc.).`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'Create a node at the origin',
    toolInput: { x: 0, y: 0, z: 0 },
  })
  .addExample({
    userInput: 'Add a node called Base at position (5, 0, 5)',
    toolInput: { x: 5, y: 0, z: 5, name: 'Base' },
  })
  .build();

export async function executeCreateNode(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { x, y, z, name } = input;
  const { state } = context;

  // Auto-generate name if not provided OR if the provided name already exists
  let nodeName = name;

  // If name is provided but already exists, auto-generate instead
  if (nodeName && state.nodes.some(n => n.name === nodeName)) {
    console.log(`   ⚠️  Node name ${nodeName} already exists, auto-generating new name...`);
    nodeName = undefined; // Force auto-generation
  }

  // Auto-generate name if needed
  if (!nodeName) {
    let counter = 1;
    while (state.nodes.some(n => n.name === `N${counter}`)) {
      counter++;
    }
    nodeName = `N${counter}`;
    console.log(`   🔢 Auto-generated node name: ${nodeName}`);
  }

  // Create the node and ADD IT TO STATE
  const newNode = { name: nodeName, x, y, z };
  state.nodes.push(newNode);

  console.log(`   ✨ Node ${nodeName} added to state. Total nodes: ${state.nodes.length}`);

  return {
    success: true,
    message: `Created node ${nodeName} at position (${x}, ${y}, ${z})`,
    data: {
      node: newNode,
    },
  };
}
