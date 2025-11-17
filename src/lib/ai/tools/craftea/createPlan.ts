import { z } from 'zod';
import { ToolSchemaBuilder } from '../common';
import { ToolContext, ToolResult } from '../../types';

const inputSchema = z.object({
  asciiPreview: z.string().describe('ASCII art visualization of the structure that will be created. REQUIRED! This shows the user what the final structure will look like.'),
  steps: z.array(z.string()).describe('Array of step descriptions that will be executed'),
  summary: z.string().describe('Brief summary of what the plan will accomplish'),
});

export const createPlanTool = ToolSchemaBuilder
  .withName('createPlan')
  .withDescription('REQUIRED FIRST STEP: Creates a plan that must be approved before any scene modifications. CALL THIS TOOL IMMEDIATELY - do NOT ask the user if you should create a plan, just CREATE IT!')
  .withInstructions(`CRITICAL: This tool is MANDATORY as the FIRST action for ANY request that creates, deletes, or modifies nodes/lines.

⚠️ CRITICAL INSTRUCTIONS - READ CAREFULLY:
⚠️ 1. DO NOT say "I will create a plan" or "Creating the plan now" or "Executing the Plan Now!" in text
⚠️ 2. DO NOT describe the nodes/lines you will create in text before calling this tool
⚠️ 3. DO NOT ask "Shall I proceed?" - just CALL THIS TOOL!
⚠️ 4. ACTIONS NOT WORDS - Use this tool, don't talk about using it!
⚠️ 5. The approval dialog appears AUTOMATICALLY after you call this tool
⚠️ 6. Put ALL plan details (ASCII art, nodes, lines, coordinates) in the TOOL PARAMETERS, not in text!

WORKFLOW:
1. User makes a request (e.g., "create a cube")
2. You IMMEDIATELY call createPlan tool with detailed steps (DO NOT ASK FIRST!)
3. The system shows the user an approval dialog with buttons
4. STOP and wait - do NOT create any nodes/lines yet
5. User clicks "Approve" or "Reject" button (or types yes/no)
6. Only after user approves, then execute the plan

Guidelines for the plan:
- Be specific about coordinates, node names, and structure details
- Break down complex operations into clear, numbered steps
- Include what will be created, modified, or deleted
- Make it easy for the user to understand what will happen
- Include counts (e.g., "Total: 8 nodes and 12 lines")
- DO NOT ask for permission in your response text - the tool call handles that!`)
  .withInputSchema(inputSchema)
  .addExample({
    userInput: 'Create a cube 3x3x3',
    toolInput: {
      asciiPreview: `    +-----+
   /|    /|
  + -----+ |
  | +---|--+
  |/    |/
  +-----+`,
      summary: 'Create a 3x3x3 cube from the origin',
      steps: [
        'Create 8 nodes for cube vertices at coordinates (0,0,0) to (3,3,3)',
        'Create 4 lines for bottom face (y=0)',
        'Create 4 lines for top face (y=3)',
        'Create 4 vertical lines connecting bottom to top',
        'Total: 8 nodes and 12 lines'
      ]
    },
  })
  .addExample({
    userInput: 'Draw a house',
    toolInput: {
      asciiPreview: `       /\\
      /  \\
     /____\\
    /|    |\\
   / |    | \\
  /  |____|  \\
  |  |    |  |
  |  |    |  |
  |__|____|__|`,
      summary: 'Create a simple 3D house with walls and triangular roof',
      steps: [
        'Create 4 nodes for house base at y=0',
        'Create 4 nodes for top of walls at y=2',
        'Create 1 apex node for roof at y=3.5',
        'Create all base edges, wall edges, and roof lines',
        'Total: 9 nodes and 16 lines'
      ]
    },
  })
  .addExample({
    userInput: 'Draw letter M in 2D mode',
    toolInput: {
      asciiPreview: `|\\  /|
| \\/ |
|    |`,
      summary: 'Create letter M with proper valley structure (2D mode, Z=0)',
      steps: [
        'Create node N1 at (0, 0, 0) - bottom left',
        'Create node N2 at (0, 2, 0) - top left',
        'Create node N3 at (1, 1, 0) - middle valley',
        'Create node N4 at (2, 2, 0) - top right',
        'Create node N5 at (2, 0, 0) - bottom right',
        'Create line L1 from N1 to N2 (left vertical)',
        'Create line L2 from N2 to N3 (left diagonal down)',
        'Create line L3 from N3 to N4 (right diagonal up)',
        'Create line L4 from N4 to N5 (right vertical)',
        'Total: 5 nodes and 4 lines'
      ]
    },
  })
  .addExample({
    userInput: 'Draw letter K in 2D mode',
    toolInput: {
      asciiPreview: `|  /
| /
|<
| \\
|  \\`,
      summary: 'Create letter K with diagonals meeting at middle junction (2D mode, Z=0)',
      steps: [
        'Create node N1 at (0, 0, 0) - bottom of vertical',
        'Create node N2 at (0, 2, 0) - top of vertical',
        'Create node N3 at (0, 1, 0) - middle junction point',
        'Create node N4 at (1, 2, 0) - upper-right diagonal end',
        'Create node N5 at (1, 0, 0) - lower-right diagonal end',
        'Create line L1 from N1 to N3 (bottom to middle - lower vertical)',
        'Create line L2 from N3 to N2 (middle to top - upper vertical)',
        'Create line L3 from N3 to N4 (middle to upper-right diagonal)',
        'Create line L4 from N3 to N5 (middle to lower-right diagonal)',
        'Total: 5 nodes and 4 lines',
        'IMPORTANT: Both diagonals connect to middle (N3), forming < shape at junction'
      ]
    },
  })
  .build();

export async function executeCreatePlan(
  input: z.infer<typeof inputSchema>,
  context: ToolContext
): Promise<ToolResult> {
  const { asciiPreview, steps, summary } = input;

  console.log(`   📋 Plan created with ${steps.length} steps`);
  console.log(`   Summary: ${summary}`);
  console.log(`   📐 ASCII Preview:\n${asciiPreview}`);

  return {
    success: true,
    message: 'Plan created and waiting for user confirmation',
    data: {
      plan: {
        asciiPreview,
        summary,
        steps,
        needsConfirmation: true,
      },
    },
  };
}
