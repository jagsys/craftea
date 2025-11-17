import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({});

export const listAllTool = ToolSchemaBuilder
  .withName('listAll')
  .withDescription('Lists all nodes and lines in the current 3D scene')
  .withInstructions(`Use this tool to get a summary of all elements in the scene.
It will return counts and basic information about all nodes and lines.`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'Show me all nodes and lines',
    toolInput: {},
  })
  .addExample({
    userInput: 'What do I have in the scene?',
    toolInput: {},
  })
  .build();

export async function executeListAll(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { state } = context;

  if (state.nodes.length === 0 && state.lines.length === 0) {
    return {
      success: true,
      message: 'The scene is empty. No nodes or lines exist yet.',
      data: { nodes: [], lines: [] },
    };
  }

  const nodesInfo = state.nodes.map(n => `${n.name} at (${n.x}, ${n.y}, ${n.z})`).join('\n  - ');
  const linesInfo = state.lines.map(l => `${l.name} connects ${l.node1} to ${l.node2}`).join('\n  - ');

  let message = `Current scene contains:\n`;

  if (state.nodes.length > 0) {
    message += `\nNodes (${state.nodes.length}):\n  - ${nodesInfo}`;
  }

  if (state.lines.length > 0) {
    message += `\n\nLines (${state.lines.length}):\n  - ${linesInfo}`;
  }

  return {
    success: true,
    message,
    data: {
      nodes: state.nodes,
      lines: state.lines,
    },
  };
}
