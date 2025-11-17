import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({
  name: z.string().describe('Name of the node or line to get information about (e.g., N1, L1)'),
});

export const getInfoTool = ToolSchemaBuilder
  .withName('getInfo')
  .withDescription('Gets detailed information about a specific node or line')
  .withInstructions(`Use this tool to retrieve information about nodes or lines.
The tool will automatically determine if the name refers to a node or line.`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'What are the coordinates of N1?',
    toolInput: { name: 'N1' },
  })
  .addExample({
    userInput: 'Tell me about line L5',
    toolInput: { name: 'L5' },
  })
  .build();

export async function executeGetInfo(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { name } = input;
  const { state } = context;

  // Check if it's a node
  const node = state.nodes.find(n => n.name === name);
  if (node) {
    return {
      success: true,
      message: `Node ${node.name} is located at coordinates (${node.x}, ${node.y}, ${node.z})`,
      data: { type: 'node', node },
    };
  }

  // Check if it's a line
  const line = state.lines.find(l => l.name === name);
  if (line) {
    const n1 = state.nodes.find(n => n.name === line.node1);
    const n2 = state.nodes.find(n => n.name === line.node2);

    if (n1 && n2) {
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dz = n2.z - n1.z;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

      return {
        success: true,
        message: `Line ${line.name} connects ${line.node1} at (${n1.x}, ${n1.y}, ${n1.z}) to ${line.node2} at (${n2.x}, ${n2.y}, ${n2.z}). Length: ${length.toFixed(2)}m`,
        data: {
          type: 'line',
          line,
          node1: n1,
          node2: n2,
          length: length.toFixed(2),
        },
      };
    }
  }

  // Not found
  return {
    success: false,
    message: `No node or line named "${name}" exists in the current scene.`,
  };
}
