import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({
  name: z.string().describe('Name of the line to delete (e.g., L1, L2)'),
});

export const deleteLineTool = ToolSchemaBuilder
  .withName('deleteLine')
  .withDescription('Deletes a line from the scene')
  .withInstructions(`Use this tool to remove a line from the scene.
The nodes connected by the line will remain in the scene.
The user has undo/redo functionality, so you can proceed confidently without asking for confirmation.`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'Delete line L3',
    toolInput: { name: 'L3' },
  })
  .addExample({
    userInput: 'Remove L7',
    toolInput: { name: 'L7' },
  })
  .build();

export async function executeDeleteLine(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { name } = input;
  const { state } = context;

  // Check if line exists
  const lineIndex = state.lines.findIndex(l => l.name === name);

  if (lineIndex === -1) {
    return {
      success: false,
      message: `Line ${name} does not exist.`,
    };
  }

  const line = state.lines[lineIndex];

  // Remove the line
  state.lines.splice(lineIndex, 1);

  console.log(`   🗑️  Deleted line ${name} (was connecting ${line.node1} to ${line.node2})`);
  console.log(`   📊 Remaining: ${state.nodes.length} nodes, ${state.lines.length} lines`);

  return {
    success: true,
    message: `Deleted line ${name} (was connecting ${line.node1} to ${line.node2})`,
    data: {
      deletedLine: name,
      node1: line.node1,
      node2: line.node2,
    },
  };
}
