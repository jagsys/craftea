'use client';

import { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '@/lib/stores/editorStore';
import { Node3D, Line3D } from '@/lib/core/Node3D';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { nodes, lines, addNode, addLine, saveHistory } = useEditorStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Convert state to simple format
      const state = {
        nodes: Array.from(nodes.values()).map((n) => ({
          name: n.name,
          x: n.x,
          y: n.y,
          z: n.z,
        })),
        lines: Array.from(lines.values()).map((l) => ({
          name: l.name,
          node1: l.node1.name,
          node2: l.node2.name,
        })),
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          state,
          threadId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();

      // Update thread ID
      if (data.threadId) {
        setThreadId(data.threadId);
      }

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message },
      ]);

      // Process tool results and update scene
      if (data.toolResults && data.toolResults.length > 0) {
        // Keep track of newly created nodes for line creation
        const createdNodes = new Map<string, Node3D>();

        // First pass: create all nodes
        for (const result of data.toolResults) {
          if (result.node) {
            const node = new Node3D(
              result.node.name,
              result.node.x,
              result.node.y,
              result.node.z
            );
            addNode(node);
            createdNodes.set(node.name, node);
            console.log(`[AI] Created node ${node.name}`);
          }
        }

        // Second pass: create all lines
        for (const result of data.toolResults) {
          if (result.line) {
            // Look in both the existing nodes and newly created nodes
            const n1 = nodes.get(result.line.node1) || createdNodes.get(result.line.node1);
            const n2 = nodes.get(result.line.node2) || createdNodes.get(result.line.node2);

            if (n1 && n2) {
              const line = new Line3D(result.line.name, n1, n2);
              addLine(line);
              console.log(`[AI] Created line ${line.name} from ${n1.name} to ${n2.name}`);
            } else {
              console.error(`[AI] Failed to create line ${result.line.name}: missing nodes`, {
                n1: result.line.node1,
                n2: result.line.node2,
                foundN1: !!n1,
                foundN2: !!n2,
              });
            }
          }
        }

        // Save to history after all changes
        saveHistory();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
      >
        AI Assistant
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-gray-900 rounded-lg shadow-2xl flex flex-col border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-white font-semibold">Craftea AI</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-gray-400 text-sm text-center mt-8">
            <p className="mb-2">Hi! I'm Craftea AI.</p>
            <p>I can help you create and modify 3D structures.</p>
            <p className="mt-4">Try saying:</p>
            <ul className="mt-2 space-y-1 text-left max-w-xs mx-auto">
              <li>"Create a node at (0, 0, 0)"</li>
              <li>"Connect N1 to N2"</li>
              <li>"Show me all nodes"</li>
            </ul>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-100 rounded-lg px-4 py-2">
              <p className="text-sm">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
