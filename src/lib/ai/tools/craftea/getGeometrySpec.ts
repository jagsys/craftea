import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';
import { getLetterSpec, getShapeSpec, getWordRequirements } from '../../knowledge/geometry-specs';

const inputSchema = z.object({
  type: z.enum(['letter', 'word', 'shape']).describe('Type of geometry to get spec for'),
  name: z.string().describe('Name of the letter, word, or shape'),
});

export const getGeometrySpecTool = ToolSchemaBuilder
  .withName('getGeometrySpec')
  .withDescription('Get detailed specification for a letter, word, or 3D shape')
  .withInstructions(`This tool retrieves detailed specifications for geometric structures.

Use this when you need to know:
- How many nodes a letter needs
- Example coordinates for a structure
- Spacing requirements for a word
- Structure rules for 3D shapes

Examples:
- getGeometrySpec({ type: 'letter', name: 'K' }) → Returns K letter spec
- getGeometrySpec({ type: 'word', name: 'HELLO' }) → Returns requirements for all letters
- getGeometrySpec({ type: 'shape', name: 'cube' }) → Returns cube spec`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'I need to know how to create letter K',
    toolInput: {
      type: 'letter',
      name: 'K',
    },
  })
  .build();

export async function executeGetGeometrySpec(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { type, name } = input;

  console.log(`   📚 Fetching ${type} spec for: ${name}`);

  if (type === 'letter') {
    const spec = getLetterSpec(name);
    if (!spec) {
      return {
        success: false,
        message: `Letter '${name}' specification not found`,
      };
    }

    return {
      success: true,
      message: `Retrieved specification for letter ${name}`,
      data: {
        spec,
        guidance: `Letter ${name} requires ${spec.minNodes} nodes and ${spec.minEdges} edges. ${spec.description}`,
      },
    };
  }

  if (type === 'word') {
    const requirements = getWordRequirements(name);

    return {
      success: true,
      message: `Retrieved requirements for word "${name}"`,
      data: {
        requirements,
        guidance: `Word "${name}" needs approximately ${requirements.totalMinNodes} nodes total. ` +
                 `Suggested horizontal spacing: ${requirements.suggestedSpacing}`,
      },
    };
  }

  if (type === 'shape') {
    const spec = getShapeSpec(name);
    if (!spec) {
      return {
        success: false,
        message: `Shape '${name}' specification not found`,
      };
    }

    return {
      success: true,
      message: `Retrieved specification for ${spec.name}`,
      data: {
        spec,
        guidance: `${spec.name} requires ${spec.minNodes} nodes and ${spec.minEdges} edges. ${spec.description}`,
      },
    };
  }

  return {
    success: false,
    message: `Unknown type: ${type}`,
  };
}
