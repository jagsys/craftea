import { NextRequest, NextResponse } from 'next/server';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { createCrafteaAgent } from '@/lib/ai/agent';
import { CrafteaState } from '@/lib/ai/types';

// Import multi-agent orchestrator (Phase 2)
// import { MultiAgentOrchestrator } from '@/lib/ai/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { message, state, threadId, conversationHistory } = await req.json();

    console.log('\n========== NEW CHAT REQUEST ==========');
    console.log('User Message:', message);
    console.log('Thread ID:', threadId || 'NEW');
    console.log('Conversation History Length:', conversationHistory?.length || 0);
    console.log('Current State:', {
      nodes: state?.nodes?.length || 0,
      lines: state?.lines?.length || 0,
    });

    // Validate input
    if (!message || typeof message !== 'string') {
      console.log('❌ Validation failed: Invalid message');
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!state || !Array.isArray(state.nodes) || !Array.isArray(state.lines)) {
      console.log('❌ Validation failed: Invalid state');
      return NextResponse.json(
        { error: 'Valid state is required' },
        { status: 400 }
      );
    }

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('❌ OpenAI API key not configured');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Create agent with current state
    const crafteaState: CrafteaState = {
      nodes: state.nodes,
      lines: state.lines,
    };

    console.log('\n🤖 Creating agent...');
    const agent = createCrafteaAgent(apiKey, crafteaState);

    // Invoke the agent
    const config = {
      configurable: {
        thread_id: threadId || `thread_${Date.now()}`,
      },
    };

    console.log('🚀 Invoking agent with config:', config.configurable);

    // Convert conversation history to LangChain messages
    const messages = [];
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        if (msg.role === 'user') {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === 'assistant') {
          messages.push(new AIMessage(msg.content));
        }
      }
    } else {
      // Fallback to single message if no history
      messages.push(new HumanMessage(message));
    }

    const result = await agent.invoke(
      {
        messages,
      },
      config
    );

    console.log('\n📦 Agent execution completed');
    console.log('Total messages in result:', result.messages.length);

    // Log all messages
    result.messages.forEach((msg, idx) => {
      const msgType = msg._getType();
      console.log(`\n--- Message ${idx + 1} (${msgType}) ---`);

      if (msgType === 'ai') {
        console.log('AI Response:', msg.content);
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          console.log('🔧 Tool Calls:', JSON.stringify(msg.tool_calls, null, 2));
        }
      } else if (msgType === 'tool') {
        console.log('🛠️  Tool Result:', msg.content);
      } else if (msgType === 'human') {
        console.log('👤 Human:', msg.content);
      }
    });

    // Extract the last message
    const resultMessages = result.messages;
    const lastMessage = resultMessages[resultMessages.length - 1];

    // Parse tool results if present (only include successful results with data)
    let toolResults = [];
    for (const msg of resultMessages) {
      if (msg._getType() === 'tool') {
        try {
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          const parsed = JSON.parse(content);
          console.log('📊 Parsed tool result:', parsed);
          // Only include successful results that have data
          if (parsed.success && parsed.data) {
            toolResults.push(parsed.data);
          } else if (!parsed.success) {
            console.log('   ℹ️  Skipping failed tool result (no data to apply)');
          }
        } catch (e) {
          console.log('⚠️  Failed to parse tool result:', e);
        }
      }
    }

    console.log('\n✅ Response prepared');
    console.log('Tool results count:', toolResults.length);
    console.log('Final message:', lastMessage.content);
    console.log('Updated state:', {
      nodes: crafteaState.nodes.length,
      lines: crafteaState.lines.length,
    });
    console.log('========== REQUEST COMPLETE ==========\n');

    return NextResponse.json({
      message: lastMessage.content,
      toolResults,
      threadId: config.configurable.thread_id,
      updatedState: crafteaState, // Return the modified state
    });
  } catch (error) {
    console.error('\n❌ ERROR IN CHAT API:');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('========== REQUEST FAILED ==========\n');

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
