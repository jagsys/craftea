import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({
  name: z.string().describe('The name of the node to move'),
  x: z.number().describe('New X coordinate'),
  y: z.number().describe('New Y coordinate'),
  z: z.number().describe('New Z coordinate'),
});

export const moveNodeTool = ToolSchemaBuilder
  .withName('moveNode')
  .withDescription('Moves an existing node to a new position. Use this to reposition nodes without recreating them.')
  .withInstructions(`Move/update the position of an existing node.

IMPORTANT: This preserves all line connections - the node stays the same, only its coordinates change.

Use this when:
- User asks to "move" a node
- User asks to "reposition" or "relocate" a node
- User asks to "update" node coordinates
- Correcting node positions

Do NOT use this for:
- Creating new nodes (use createNode)
- Deleting nodes (use deleteNode)`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'Move N5 to (3, 4, 2)',
    toolInput: {
      name: 'N5',
      x: 3,
      y: 4,
      z: 2,
    },
  })
  .build();

export async function executeMoveNode(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { name, x, y, z } = input;
  const { state } = context;

  const node = state.nodes.find(n => n.name === name);

  if (!node) {
    return {
      success: false,
      message: `Node ${name} does not exist. Cannot move a non-existent node.`,
    };
  }

  const oldPosition = { x: node.x, y: node.y, z: node.z };

  // Update the node's position
  node.x = x;
  node.y = y;
  node.z = z;

  console.log(`   📍 Moved ${name} from (${oldPosition.x}, ${oldPosition.y}, ${oldPosition.z}) to (${x}, ${y}, ${z})`);

  return {
    success: true,
    message: `Moved node ${name} from (${oldPosition.x}, ${oldPosition.y}, ${oldPosition.z}) to (${x}, ${y}, ${z})`,
    data: {
      movedNode: {
        name,
        oldPosition,
        newPosition: { x, y, z },
      },
    },
  };
}
