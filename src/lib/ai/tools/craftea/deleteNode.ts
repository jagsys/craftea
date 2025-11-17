import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({
  name: z.string().describe('Name of the node to delete (e.g., N1, N2)'),
});

export const deleteNodeTool = ToolSchemaBuilder
  .withName('deleteNode')
  .withDescription('Deletes a node and all lines connected to it')
  .withInstructions(`Use this tool to remove a node from the scene.
This will automatically delete all lines connected to this node.
The user has undo/redo functionality, so you can proceed confidently without asking for confirmation.`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'Delete node N5',
    toolInput: { name: 'N5' },
  })
  .addExample({
    userInput: 'Remove N12',
    toolInput: { name: 'N12' },
  })
  .build();

export async function executeDeleteNode(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { name } = input;
  const { state } = context;

  // Check if node exists
  const nodeIndex = state.nodes.findIndex(n => n.name === name);

  if (nodeIndex === -1) {
    return {
      success: false,
      message: `Node ${name} does not exist.`,
    };
  }

  // Find all lines connected to this node
  const connectedLines = state.lines.filter(
    l => l.node1 === name || l.node2 === name
  );

  // Remove all connected lines
  state.lines = state.lines.filter(
    l => l.node1 !== name && l.node2 !== name
  );

  // Remove the node
  state.nodes.splice(nodeIndex, 1);

  console.log(`   🗑️  Deleted node ${name} and ${connectedLines.length} connected line(s)`);
  console.log(`   📊 Remaining: ${state.nodes.length} nodes, ${state.lines.length} lines`);

  const message = connectedLines.length > 0
    ? `Deleted node ${name} and ${connectedLines.length} connected line(s): ${connectedLines.map(l => l.name).join(', ')}`
    : `Deleted node ${name}`;

  return {
    success: true,
    message,
    data: {
      deletedNode: name,
      deletedLines: connectedLines.map(l => l.name),
    },
  };
}
