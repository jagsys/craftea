import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';
import { MemorySaver } from './checkpointer';
import { getSystemPrompt } from './prompts/system';
import { CrafteaState, ToolContext } from './types';
import {
  createPlanTool,
  reviewPlanTool,
  createNodeTool,
  moveNodeTool,
  createLineTool,
  deleteNodeTool,
  deleteLineTool,
  getInfoTool,
  listAllTool,
  fixIntersectionsTool,
  validateAsciiStructureTool,
  validateStructureTool,
  executeCreatePlan,
  executeReviewPlan,
  executeCreateNode,
  executeMoveNode,
  executeCreateLine,
  executeDeleteNode,
  executeDeleteLine,
  executeGetInfo,
  executeListAll,
  executeFixIntersections,
  executeValidateAsciiStructure,
  executeValidateStructure,
} from './tools/craftea';
import { DynamicStructuredTool } from '@langchain/core/tools';

// Tool executors map
const toolExecutors = {
  createPlan: executeCreatePlan,
  reviewPlan: executeReviewPlan,
  createNode: executeCreateNode,
  moveNode: executeMoveNode,
  createLine: executeCreateLine,
  deleteNode: executeDeleteNode,
  deleteLine: executeDeleteLine,
  getInfo: executeGetInfo,
  listAll: executeListAll,
  fixIntersections: executeFixIntersections,
  validateAsciiStructure: executeValidateAsciiStructure,
  validateStructure: executeValidateStructure,
};

// Create LangChain tools from our tool schemas
function createLangChainTools(context: ToolContext) {
  return [
    new DynamicStructuredTool({
      name: createPlanTool.name,
      description: createPlanTool.description,
      schema: createPlanTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${createPlanTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.createPlan(input, context);
        console.log(`✅ [TOOL] ${createPlanTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: reviewPlanTool.name,
      description: reviewPlanTool.description,
      schema: reviewPlanTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${reviewPlanTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.reviewPlan(input, context);
        console.log(`✅ [TOOL] ${reviewPlanTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: createNodeTool.name,
      description: createNodeTool.description,
      schema: createNodeTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${createNodeTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.createNode(input, context);
        console.log(`✅ [TOOL] ${createNodeTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: moveNodeTool.name,
      description: moveNodeTool.description,
      schema: moveNodeTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${moveNodeTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.moveNode(input, context);
        console.log(`✅ [TOOL] ${moveNodeTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: createLineTool.name,
      description: createLineTool.description,
      schema: createLineTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${createLineTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.createLine(input, context);
        console.log(`✅ [TOOL] ${createLineTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: deleteNodeTool.name,
      description: deleteNodeTool.description,
      schema: deleteNodeTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${deleteNodeTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.deleteNode(input, context);
        console.log(`✅ [TOOL] ${deleteNodeTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: deleteLineTool.name,
      description: deleteLineTool.description,
      schema: deleteLineTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${deleteLineTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.deleteLine(input, context);
        console.log(`✅ [TOOL] ${deleteLineTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: getInfoTool.name,
      description: getInfoTool.description,
      schema: getInfoTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${getInfoTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.getInfo(input, context);
        console.log(`✅ [TOOL] ${getInfoTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: listAllTool.name,
      description: listAllTool.description,
      schema: listAllTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${listAllTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.listAll(input, context);
        console.log(`✅ [TOOL] ${listAllTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: fixIntersectionsTool.name,
      description: fixIntersectionsTool.description,
      schema: fixIntersectionsTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${fixIntersectionsTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.fixIntersections(input, context);
        console.log(`✅ [TOOL] ${fixIntersectionsTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: validateAsciiStructureTool.name,
      description: validateAsciiStructureTool.description,
      schema: validateAsciiStructureTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${validateAsciiStructureTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.validateAsciiStructure(input, context);
        console.log(`✅ [TOOL] ${validateAsciiStructureTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
    new DynamicStructuredTool({
      name: validateStructureTool.name,
      description: validateStructureTool.description,
      schema: validateStructureTool.schema,
      func: async (input) => {
        console.log(`\n🔧 [TOOL] ${validateStructureTool.name} called with:`, JSON.stringify(input, null, 2));
        const result = await toolExecutors.validateStructure(input, context);
        console.log(`✅ [TOOL] ${validateStructureTool.name} result:`, JSON.stringify(result, null, 2));
        return JSON.stringify(result);
      },
    }),
  ];
}

// Create the agent graph
export function createCrafteaAgent(apiKey: string, state: CrafteaState) {
  const context: ToolContext = { state };
  const tools = createLangChainTools(context);

  console.log('📋 Available tools:', tools.map(t => t.name).join(', '));
  console.log('📊 Current state:', {
    nodes: state.nodes.length,
    lines: state.lines.length,
  });

  // Initialize the OpenAI model
  const model = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.7,
    openAIApiKey: apiKey,
  }).bindTools(tools);

  console.log('🤖 Model initialized: gpt-4o-mini');

  // Define the function that calls the model
  async function callModel(state: typeof MessagesAnnotation.State) {
    console.log('\n🧠 [AGENT] Calling model...');
    console.log('📥 Input messages count:', state.messages.length);
    console.log('📊 Current context state: nodes =', context.state.nodes.length, ', lines =', context.state.lines.length);

    const systemPrompt = getSystemPrompt(context.state);
    const messages = [new SystemMessage(systemPrompt), ...state.messages];

    console.log('💭 System prompt length:', systemPrompt.length, 'chars');

    const response = await model.invoke(messages);

    console.log('📤 [AGENT] Model response received');
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log('🎯 [AGENT] Will call', response.tool_calls.length, 'tool(s)');
    } else {
      console.log('💬 [AGENT] Final response (no tool calls)');
    }

    return { messages: [response] };
  }

  // Create the graph
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', callModel)
    .addNode('tools', new ToolNode(tools))
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent');

  console.log('🔗 Graph created with nodes: agent, tools');

  // Compile WITHOUT checkpointer - we manage state ourselves
  // const checkpointer = new MemorySaver();
  // return workflow.compile({ checkpointer });
  return workflow.compile();
}

// Determine whether to continue or end
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If the LLM makes a tool call, route to tools
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log('🔀 [ROUTING] → tools (agent requested tool calls)');
    return 'tools';
  }

  // Otherwise, we're done
  console.log('🔀 [ROUTING] → END (no tool calls, conversation complete)');
  return END;
}
