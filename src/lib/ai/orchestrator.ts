/**
 * MULTI-AGENT ORCHESTRATOR
 *
 * Coordinates the specialized agents to handle user requests.
 * Flow: User → Planner → Reviewer → (if approved) → Executor → Explainer → User
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CrafteaState, ToolContext } from './types';
import { getPlannerSystemPrompt } from './agents/planner-agent';
import { getReviewerSystemPrompt } from './agents/reviewer-agent';
import { getExecutorSystemPrompt } from './agents/executor-agent';
import { getExplainerSystemPrompt } from './agents/explainer-agent';
import { getLetterSpec, getShapeSpec, getWordRequirements } from './knowledge/geometry-specs';
import {
  createPlanTool,
  reviewPlanTool,
  createNodeTool,
  createLineTool,
  deleteNodeTool,
  deleteLineTool,
  fixIntersectionsTool,
  getGeometrySpecTool,
  validateAsciiStructureTool,
  executeCreatePlan,
  executeReviewPlan,
  executeCreateNode,
  executeCreateLine,
  executeDeleteNode,
  executeDeleteLine,
  executeFixIntersections,
  executeGetGeometrySpec,
  executeValidateAsciiStructure,
} from './tools/craftea';

interface OrchestrationContext {
  apiKey: string;
  state: CrafteaState;
  userRequest: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export class MultiAgentOrchestrator {
  constructor(private apiKey: string) {}

  /**
   * Main orchestration flow
   */
  async handleRequest(context: OrchestrationContext): Promise<{
    plan?: any;
    approved: boolean;
    needsUserApproval: boolean;
    message: string;
    toolResults?: any[];
  }> {
    const { userRequest, state } = context;

    // Step 1: Check if this is an approval response
    if (this.isApprovalResponse(userRequest)) {
      // Execute the pending plan
      return await this.executePlan(context);
    }

    // Step 2: Determine intent and inject relevant knowledge
    const relevantKnowledge = this.injectRelevantKnowledge(userRequest);

    // Step 3: Call Planner Agent to create a plan
    const planResult = await this.callPlannerAgent(context, relevantKnowledge);

    if (!planResult.plan) {
      // No plan created - this might be a query or info request
      return {
        approved: true,
        needsUserApproval: false,
        message: planResult.message,
      };
    }

    // Step 4: Call Reviewer Agent to validate the plan
    const reviewResult = await this.callReviewerAgent({
      ...context,
      plan: planResult.plan,
    });

    if (!reviewResult.approved) {
      // Plan rejected - send feedback back to planner for revision
      return await this.revisePlan(context, reviewResult.feedback, relevantKnowledge);
    }

    // Step 5: Plan approved - present to user for approval
    return {
      plan: planResult.plan,
      approved: true,
      needsUserApproval: true,
      message: await this.formatPlanForUser(planResult.plan),
    };
  }

  /**
   * Inject only relevant knowledge based on user request
   */
  private injectRelevantKnowledge(userRequest: string): string {
    const lower = userRequest.toLowerCase();
    let knowledge = '';

    // Check for single letter
    const singleLetterMatch = lower.match(/letter\s+([a-z])|draw\s+(?:a|an)\s+([a-z])\b/);
    if (singleLetterMatch) {
      const letter = (singleLetterMatch[1] || singleLetterMatch[2]).toUpperCase();
      const spec = getLetterSpec(letter);
      if (spec) {
        knowledge += `\n### Letter ${letter} Specification\n`;
        knowledge += `- Nodes: ${spec.minNodes} minimum\n`;
        knowledge += `- Edges: ${spec.minEdges}\n`;
        knowledge += `- Description: ${spec.description}\n`;
        if (spec.example) {
          knowledge += `- Example coordinates: ${JSON.stringify(spec.example.coordinates)}\n`;
        }
        if (spec.ascii) {
          knowledge += `- ASCII:\n${spec.ascii}\n`;
        }
      }
    }

    // Check for word
    const wordMatch = lower.match(/word\s+([a-z]+)|draw\s+(?:the\s+word\s+)?([a-z]{2,})/);
    if (wordMatch) {
      const word = (wordMatch[1] || wordMatch[2]).toUpperCase();
      const requirements = getWordRequirements(word);
      knowledge += `\n### Word "${word}" Requirements\n`;
      knowledge += `- Total minimum nodes: ${requirements.totalMinNodes}\n`;
      knowledge += `- Per letter: ${requirements.letterBreakdown.map(l => `${l.letter}(${l.minNodes})`).join(' + ')}\n`;
      knowledge += `- Suggested spacing: ${requirements.suggestedSpacing}\n`;
    }

    // Check for shapes
    const shapeMatch = lower.match(/\b(cube|house|pyramid|tetrahedron)\b/);
    if (shapeMatch) {
      const shapeName = shapeMatch[1];
      const spec = getShapeSpec(shapeName);
      if (spec) {
        knowledge += `\n### ${spec.name} Specification\n`;
        knowledge += `- Nodes: ${spec.minNodes}\n`;
        knowledge += `- Edges: ${spec.minEdges}\n`;
        knowledge += `- Description: ${spec.description}\n`;
      }
    }

    return knowledge;
  }

  /**
   * Call Planner Agent
   */
  private async callPlannerAgent(
    context: OrchestrationContext,
    knowledge: string
  ): Promise<{ plan?: any; message: string }> {
    console.log('\n🎯 [PLANNER AGENT] Starting...');

    const systemPrompt = getPlannerSystemPrompt(context.state);
    const toolContext: ToolContext = { state: context.state };

    // Planner only has access to createPlan tool and getGeometrySpec
    const tools = [
      new DynamicStructuredTool({
        name: createPlanTool.name,
        description: createPlanTool.description,
        schema: createPlanTool.schema,
        func: async (input) => {
          const result = await executeCreatePlan(input, toolContext);
          return JSON.stringify(result);
        },
      }),
      new DynamicStructuredTool({
        name: getGeometrySpecTool.name,
        description: getGeometrySpecTool.description,
        schema: getGeometrySpecTool.schema,
        func: async (input) => {
          const result = await executeGetGeometrySpec(input, toolContext);
          return JSON.stringify(result);
        },
      }),
    ];

    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      openAIApiKey: this.apiKey,
    }).bindTools(tools);

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(`${knowledge}\n\nUser request: ${context.userRequest}`),
    ];

    const response = await model.invoke(messages);

    // Extract plan from tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === 'createPlan') {
          console.log('✅ [PLANNER] Created plan');
          return {
            plan: toolCall.args,
            message: response.content as string || 'Plan created',
          };
        }
      }
    }

    // No plan created - might be a query or info request
    console.log('ℹ️ [PLANNER] No plan created - likely an informational request');
    return {
      plan: null,
      message: response.content as string,
    };
  }

  /**
   * Call Reviewer Agent
   */
  private async callReviewerAgent(context: OrchestrationContext & { plan: any }): Promise<{
    approved: boolean;
    feedback?: string;
  }> {
    console.log('\n🔍 [REVIEWER AGENT] Starting validation...');

    const systemPrompt = getReviewerSystemPrompt(context.state);
    const toolContext: ToolContext = { state: context.state };

    // Reviewer has access to validateAsciiStructure and reviewPlan tools
    const tools = [
      new DynamicStructuredTool({
        name: validateAsciiStructureTool.name,
        description: validateAsciiStructureTool.description,
        schema: validateAsciiStructureTool.schema,
        func: async (input) => {
          const result = await executeValidateAsciiStructure(input, toolContext);
          return JSON.stringify(result);
        },
      }),
      new DynamicStructuredTool({
        name: reviewPlanTool.name,
        description: reviewPlanTool.description,
        schema: reviewPlanTool.schema,
        func: async (input) => {
          const result = await executeReviewPlan(input, toolContext);
          return JSON.stringify(result);
        },
      }),
    ];

    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.3, // Lower temperature for validation
      openAIApiKey: this.apiKey,
    }).bindTools(tools);

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(
        `Review this plan:\n\nUser Request: ${context.userRequest}\n\nPlan: ${JSON.stringify(context.plan, null, 2)}`
      ),
    ];

    const response = await model.invoke(messages);

    // Extract review result from tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === 'reviewPlan') {
          const resultStr = await tools[0].func(toolCall.args);
          const result = JSON.parse(resultStr);

          if (result.data?.approved) {
            console.log('✅ [REVIEWER] Plan approved');
            return { approved: true };
          } else {
            console.log('❌ [REVIEWER] Plan rejected:', result.data?.feedback);
            return {
              approved: false,
              feedback: result.data?.feedback || 'Plan needs revision',
            };
          }
        }
      }
    }

    // Default to approved if no review tool was called
    console.log('ℹ️ [REVIEWER] No explicit review - defaulting to approved');
    return { approved: true };
  }

  /**
   * Call Executor Agent
   */
  private async executePlan(context: OrchestrationContext): Promise<any> {
    console.log('\n⚙️ [EXECUTOR AGENT] Starting execution...');

    const systemPrompt = getExecutorSystemPrompt();
    const toolContext: ToolContext = { state: context.state };

    // Executor has access to all execution tools
    const tools = [
      new DynamicStructuredTool({
        name: createNodeTool.name,
        description: createNodeTool.description,
        schema: createNodeTool.schema,
        func: async (input) => {
          const result = await executeCreateNode(input, toolContext);
          return JSON.stringify(result);
        },
      }),
      new DynamicStructuredTool({
        name: createLineTool.name,
        description: createLineTool.description,
        schema: createLineTool.schema,
        func: async (input) => {
          const result = await executeCreateLine(input, toolContext);
          return JSON.stringify(result);
        },
      }),
      new DynamicStructuredTool({
        name: deleteNodeTool.name,
        description: deleteNodeTool.description,
        schema: deleteNodeTool.schema,
        func: async (input) => {
          const result = await executeDeleteNode(input, toolContext);
          return JSON.stringify(result);
        },
      }),
      new DynamicStructuredTool({
        name: deleteLineTool.name,
        description: deleteLineTool.description,
        schema: deleteLineTool.schema,
        func: async (input) => {
          const result = await executeDeleteLine(input, toolContext);
          return JSON.stringify(result);
        },
      }),
      new DynamicStructuredTool({
        name: fixIntersectionsTool.name,
        description: fixIntersectionsTool.description,
        schema: fixIntersectionsTool.schema,
        func: async (input) => {
          const result = await executeFixIntersections(input, toolContext);
          return JSON.stringify(result);
        },
      }),
    ];

    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.1, // Very low temperature for precise execution
      openAIApiKey: this.apiKey,
    }).bindTools(tools);

    // TODO: Get the approved plan from context (needs state management)
    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(`Execute the approved plan. User confirmed: ${context.userRequest}`),
    ];

    const response = await model.invoke(messages);

    console.log('✅ [EXECUTOR] Execution complete');

    return {
      approved: true,
      needsUserApproval: false,
      message: response.content as string || 'Plan executed successfully!',
      toolResults: response.tool_calls || [],
    };
  }

  /**
   * Revise plan based on reviewer feedback
   */
  private async revisePlan(
    context: OrchestrationContext,
    feedback: string,
    knowledge: string
  ): Promise<any> {
    console.log('\n🔄 [ORCHESTRATOR] Requesting plan revision...');
    console.log('   Feedback:', feedback);

    // Call planner again with feedback
    const systemPrompt = getPlannerSystemPrompt(context.state);
    const toolContext: ToolContext = { state: context.state };

    const tools = [
      new DynamicStructuredTool({
        name: createPlanTool.name,
        description: createPlanTool.description,
        schema: createPlanTool.schema,
        func: async (input) => {
          const result = await executeCreatePlan(input, toolContext);
          return JSON.stringify(result);
        },
      }),
    ];

    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      openAIApiKey: this.apiKey,
    }).bindTools(tools);

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(
        `${knowledge}\n\nUser request: ${context.userRequest}\n\nPREVIOUS PLAN WAS REJECTED. Reviewer feedback:\n${feedback}\n\nPlease create a REVISED plan that addresses this feedback.`
      ),
    ];

    const response = await model.invoke(messages);

    // Extract revised plan
    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.name === 'createPlan') {
          const revisedPlan = toolCall.args;

          // Re-validate with reviewer
          const reviewResult = await this.callReviewerAgent({
            ...context,
            plan: revisedPlan,
          });

          if (reviewResult.approved) {
            console.log('✅ [ORCHESTRATOR] Revised plan approved');
            return {
              plan: revisedPlan,
              approved: true,
              needsUserApproval: true,
              message: await this.formatPlanForUser(revisedPlan),
            };
          } else {
            console.log('❌ [ORCHESTRATOR] Revised plan still has issues');
            return {
              approved: false,
              needsUserApproval: false,
              message: `Unable to create a valid plan. Issues:\n${reviewResult.feedback}`,
            };
          }
        }
      }
    }

    return {
      approved: false,
      needsUserApproval: false,
      message: `Plan needs revision: ${feedback}`,
    };
  }

  /**
   * Format plan for user approval
   */
  private async formatPlanForUser(plan: any): Promise<string> {
    let message = '📋 Plan Created\n\n';

    if (plan.summary) {
      message += `**Summary:** ${plan.summary}\n\n`;
    }

    if (plan.asciiPreview) {
      message += `**Preview:**\n\`\`\`\n${plan.asciiPreview}\n\`\`\`\n\n`;
    }

    if (plan.steps && plan.steps.length > 0) {
      message += `**Steps:**\n`;
      plan.steps.forEach((step: string, i: number) => {
        message += `${i + 1}. ${step}\n`;
      });
    }

    message += '\n✅ Plan ready for execution. Approve to proceed.';

    return message;
  }

  /**
   * Check if user message is an approval response
   */
  private isApprovalResponse(message: string): boolean {
    const lower = message.toLowerCase().trim();
    return ['yes', 'y', 'approve', 'approved', 'ok', 'proceed'].includes(lower);
  }
}
