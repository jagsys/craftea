'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { CommandInput } from '@/components/editor/CommandInput';
import { useEditorStore } from '@/lib/stores/editorStore';
import { Node3D, Line3D } from '@/lib/core/Node3D';
import { exportToJSON, importFromJSON } from '@/lib/utils/fileUtils';

const Viewport3D = dynamic(
  () => import('@/components/editor/Viewport3D').then((mod) => mod.Viewport3D),
  { ssr: false }
);

export default function EditorPage() {
  const [output, setOutput] = useState<string[]>([]);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<{ summary: string; steps: string[]; timestamp: number } | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debug: Log when pendingPlan changes
  useEffect(() => {
    console.log('🎯 [BANNER DEBUG] pendingPlan changed:', pendingPlan);
    if (pendingPlan) {
      console.log('✅ [BANNER DEBUG] Banner SHOULD be visible now with timestamp:', pendingPlan.timestamp);
      console.log('✅ [BANNER DEBUG] Summary:', pendingPlan.summary);
      console.log('✅ [BANNER DEBUG] Steps count:', pendingPlan.steps.length);
    } else {
      console.log('❌ [BANNER DEBUG] Banner should be hidden (pendingPlan is null)');
    }
  }, [pendingPlan]);
  const { nodes, lines, gridSize, showAxisLabels, showNodes, showLineLabels, is2DMode, addNode, addLine, removeLine, removeNode, clear, setGridSize, setShowAxisLabels, setShowNodes, setShowLineLabels, set2DMode, loadProject, undo, redo, canUndo, canRedo, saveHistory } = useEditorStore();

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  // Keyboard shortcuts for plan approval - using direct reference to avoid stale closures
  useEffect(() => {
    if (!pendingPlan) {
      console.log('⌨️ [KEYBOARD] No pending plan, keyboard shortcuts disabled');
      return;
    }

    console.log('⌨️ [KEYBOARD] Keyboard shortcuts enabled for plan:', pendingPlan.timestamp);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        console.log('⌨️ [KEYBOARD] Y/Enter key pressed - triggering approval');
        // Find and click the approval button to use the same handler
        const approveButton = document.querySelector('[data-action="approve"]') as HTMLButtonElement;
        if (approveButton) {
          approveButton.click();
        }
      } else if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        console.log('⌨️ [KEYBOARD] N/Esc key pressed - triggering rejection');
        // Find and click the rejection button to use the same handler
        const rejectButton = document.querySelector('[data-action="reject"]') as HTMLButtonElement;
        if (rejectButton) {
          rejectButton.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      console.log('⌨️ [KEYBOARD] Removing keyboard shortcuts');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pendingPlan]);

  const handleSave = () => {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const projectName = `craftea-${timestamp}`;
    exportToJSON(nodes, lines, projectName);
    setOutput((prev) => [...prev, `✓ Project saved as ${projectName}.json`]);
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileLoad = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { nodes: loadedNodes, lines: loadedLines } = await importFromJSON(file);
      loadProject(loadedNodes, loadedLines, { name: file.name.replace('.json', '') });
      setOutput((prev) => [...prev, `✓ Loaded ${loadedNodes.length} nodes and ${loadedLines.length} lines from ${file.name}`]);
    } catch (error) {
      setOutput((prev) => [...prev, `✗ Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Detect if input is a command or natural language
  const isCommand = (input: string): boolean => {
    const trimmed = input.trim();
    const lowerInput = trimmed.toLowerCase();

    // Known command patterns
    const commandPatterns = [
      /^n\d*\[/i,           // N[x,y,z] or N1[x,y,z]
      /^l\d*\[/i,           // L[1,2] or L1[N1,N2]
      /^split\s+/i,         // split L1 3
      /^intersect\s+/i,     // intersect N1 N2 L1
      /^del(ete)?\s+/i,     // del N1 or delete L1
      /^(list|ls)$/i,       // list or ls
      /^clear$/i,           // clear
      /^grid\s+/i,          // grid 20
      /^grid$/i,            // grid
      /^axis$/i,            // axis
      /^nodes$/i,           // nodes
      /^lines$/i,           // lines
      /^(help|\?)$/i,       // help or ?
    ];

    // Also check for simple node/line info queries
    if (/^[NL]\d+$/i.test(trimmed)) {
      return true;
    }

    return commandPatterns.some(pattern => pattern.test(trimmed));
  };

  // Handle AI assistant
  const handleAIRequest = async (input: string) => {
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsAIProcessing(true);
    setOutput((prev) => [...prev, `🤖 AI: ${input}`]);

    // Add user message to conversation history
    const updatedHistory = [...conversationHistory, { role: 'user' as const, content: input }];
    setConversationHistory(updatedHistory);

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
        is2DMode,
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          state,
          threadId,
          conversationHistory: updatedHistory,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();

      // Update thread ID
      if (data.threadId) {
        setThreadId(data.threadId);
      }

      // Check if there's an APPROVED plan from reviewPlan tool that needs user confirmation
      console.log('🔍 [PLAN CHECK] Checking for plan in toolResults:', data.toolResults);

      // Look for reviewPlan result with approved=true
      const reviewResult = data.toolResults?.find((r: any) => r.approved === true && r.plan);

      // Fallback: if no review result, look for createPlan result (for backwards compatibility)
      const planResult = reviewResult || data.toolResults?.find((r: any) => r.plan?.needsConfirmation);

      console.log('📋 [PLAN CHECK] Review result:', reviewResult);
      console.log('📋 [PLAN CHECK] Plan result found:', planResult);

      if (planResult?.plan) {
        const timestamp = Date.now();
        console.log('✅ [PLAN CHECK] Setting pending plan with timestamp:', timestamp);
        console.log('✅ [PLAN CHECK] Plan details:', planResult.plan);
        console.log('🔔 [PLAN CHECK] BANNER SHOULD APPEAR NOW!');
        // Show plan for confirmation - add timestamp to force new object reference
        setPendingPlan({
          ...planResult.plan,
          timestamp,
        });
        setOutput((prev) => [
          ...prev,
          '',
          '═══════════════════════════════════════════',
          '📋 PLAN CREATED - APPROVAL REQUIRED',
          '═══════════════════════════════════════════',
          '',
          ...(planResult.plan.asciiPreview ? [
            '📐 Preview:',
            '',
            ...planResult.plan.asciiPreview.split('\n').map((line: string) => `  ${line}`),
            '',
          ] : []),
          `Summary: ${planResult.plan.summary}`,
          '',
          'Steps:',
          ...planResult.plan.steps.map((step: string, i: number) => `  ${i + 1}. ${step}`),
          '',
          '═══════════════════════════════════════════',
          '⚠️  WAITING FOR YOUR APPROVAL',
          '═══════════════════════════════════════════',
          '',
          '👉 Use the buttons below OR type "yes"/"no"',
          '',
        ]);
        // Add assistant's plan response to conversation history
        setConversationHistory(prev => [...prev, { role: 'assistant', content: data.message }]);
        return;
      }
      console.log('❌ No plan found, continuing normally');

      // Add AI response to output
      setOutput((prev) => [...prev, `   ${data.message}`]);

      // Add assistant's response to conversation history
      setConversationHistory(prev => [...prev, { role: 'assistant', content: data.message }]);

      // Process tool results and update scene
      if (data.toolResults && data.toolResults.length > 0) {
        // Keep track of newly created nodes for line creation
        const createdNodes = new Map<string, Node3D>();

        // First pass: handle deletions
        for (const result of data.toolResults) {
          // Delete nodes (this also removes connected lines)
          if (result.deletedNode) {
            removeNode(result.deletedNode);
          }
          // Delete individual lines
          if (result.deletedLine) {
            removeLine(result.deletedLine);
          }
        }

        // Second pass: handle moved nodes
        for (const result of data.toolResults) {
          if (result.movedNode) {
            const existingNode = nodes.get(result.movedNode.name);
            if (existingNode) {
              existingNode.x = result.movedNode.newPosition.x;
              existingNode.y = result.movedNode.newPosition.y;
              existingNode.z = result.movedNode.newPosition.z;
            }
          }
        }

        // Third pass: create all nodes
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
          }
        }

        // Fourth pass: create all lines
        for (const result of data.toolResults) {
          if (result.line) {
            // Look in both the existing nodes and newly created nodes
            const n1 = nodes.get(result.line.node1) || createdNodes.get(result.line.node1);
            const n2 = nodes.get(result.line.node2) || createdNodes.get(result.line.node2);

            if (n1 && n2) {
              const line = new Line3D(result.line.name, n1, n2);
              addLine(line);
            }
          }
        }

        // Save to history after all changes
        saveHistory();
      }
    } catch (error) {
      // Check if the error is due to abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted by user');
        return; // Already handled in the stop button onClick
      }
      console.error('Error with AI:', error);
      setOutput((prev) => [...prev, '   ✗ Sorry, I encountered an error. Please try again.']);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleCommand = async (command: string) => {
    const trimmed = command.trim();
    const lowerCommand = trimmed.toLowerCase();

    // Handle plan approval/rejection
    if (pendingPlan) {
      if (lowerCommand === 'yes' || lowerCommand === 'approve' || lowerCommand === 'y' || lowerCommand === 'go ahead' || lowerCommand === 'proceed') {
        console.log('✅ [APPROVAL] User approved plan with timestamp:', pendingPlan.timestamp);
        setOutput((prev) => [...prev, `> ${command}`, '✓ Plan approved, executing...']);
        console.log('🗑️ [APPROVAL] Clearing pendingPlan (setting to null)');
        setPendingPlan(null);
        // Send approval to AI to continue execution
        await handleAIRequest('Yes, approved. Please proceed with the plan.');
        return;
      } else if (lowerCommand === 'no' || lowerCommand === 'reject' || lowerCommand === 'n' || lowerCommand === 'cancel') {
        console.log('❌ [REJECTION] User rejected plan with timestamp:', pendingPlan.timestamp);
        setOutput((prev) => [...prev, `> ${command}`, '✗ Plan rejected']);
        console.log('🗑️ [REJECTION] Clearing pendingPlan (setting to null)');
        setPendingPlan(null);
        return;
      }
    }

    // Check if this is a command or natural language
    if (!isCommand(command)) {
      // Send to AI
      await handleAIRequest(command);
      return;
    }

    // Otherwise execute as a command
    if (lowerCommand === 'help' || trimmed === '?') {
      setOutput((prev) => [
        ...prev,
        '─────── Available Commands ───────',
        '',
        'AI Assistant:',
        '  Just type naturally! Examples:',
        '    "create a cube 3x3"',
        '    "make a pyramid with base 4m"',
        '    "show me all nodes"',
        '',
        'Nodes:',
        '  N1[x,y,z]     - Create named node (e.g., N1[0,0,0])',
        '  N[x,y,z]      - Create auto-named node (e.g., N[3,0,0])',
        '  del N1        - Delete a node and its connected lines',
        '',
        'Lines:',
        '  L1[1,2]       - Create named line (e.g., L1[1,2] or L1[N1,N2])',
        '  L[1,2]        - Create auto-named line (e.g., L[1,2] or L[N1,N2])',
        '  del L1        - Delete a line (e.g., del L3 or delete L3)',
        '  split L1 [n]  - Split line into n equal parts (e.g., split L1 3)',
        '  intersect N1 N2 L1 - Find intersection and create node (e.g., intersect N4 N7 L1)',
        '',
        'Info:',
        '  N1            - Show node coordinates (e.g., N8)',
        '  L1            - Show line information (e.g., L3)',
        '',
        'View:',
        '  grid [size]   - Set grid size (1-100, default 10)',
        '  axis          - Toggle axis labels on/off',
        '  nodes         - Toggle node visibility on/off',
        '  lines         - Toggle line labels on/off',
        '  list / ls     - List all nodes and lines',
        '  clear         - Clear the scene',
        '  help / ?      - Show this help',
        '',
        '─────────────────────────────────',
      ]);
      return;
    }

    const gridMatch = lowerCommand.match(/^grid\s+(\d+)$/);
    if (gridMatch) {
      const size = parseInt(gridMatch[1]);
      if (size < 1 || size > 100) {
        setOutput((prev) => [...prev, '✗ Grid size must be between 1 and 100']);
        return;
      }
      setGridSize(size);
      setOutput((prev) => [...prev, `✓ Grid size set to ${size}x${size} (each cell = 1m)`]);
      return;
    }

    if (lowerCommand === 'grid') {
      setOutput((prev) => [...prev, `Current grid size: ${gridSize}x${gridSize} (each cell = 1m)`]);
      return;
    }

    if (lowerCommand === 'axis') {
      setShowAxisLabels(!showAxisLabels);
      setOutput((prev) => [...prev, `✓ Axis labels ${!showAxisLabels ? 'shown' : 'hidden'}`]);
      return;
    }

    if (lowerCommand === 'nodes') {
      setShowNodes(!showNodes);
      setOutput((prev) => [...prev, `✓ Nodes ${!showNodes ? 'shown' : 'hidden'}`]);
      return;
    }

    if (lowerCommand === 'lines') {
      setShowLineLabels(!showLineLabels);
      setOutput((prev) => [...prev, `✓ Line labels ${!showLineLabels ? 'shown' : 'hidden'}`]);
      return;
    }

    if (lowerCommand === 'clear') {
      clear();
      saveHistory();
      setOutput((prev) => [...prev, '✓ Scene cleared']);
      return;
    }

    // Delete command for nodes and lines
    const deleteMatch = lowerCommand.match(/^(del|delete)\s+([nl]\d+)$/);
    if (deleteMatch) {
      const [, , name] = deleteMatch;
      const upperName = name.toUpperCase();

      if (upperName.startsWith('N')) {
        const node = nodes.get(upperName);
        if (!node) {
          setOutput((prev) => [...prev, `✗ Node ${upperName} not found`]);
          return;
        }

        // Find lines connected to this node
        const connectedLines: string[] = [];
        for (const [lineName, line] of lines) {
          if (line.node1.name === upperName || line.node2.name === upperName) {
            connectedLines.push(lineName);
          }
        }

        removeNode(upperName);
        saveHistory();

        const messages = [`✓ Deleted node ${upperName}`];
        if (connectedLines.length > 0) {
          messages.push(`  Also removed ${connectedLines.length} connected line(s): ${connectedLines.join(', ')}`);
        }
        setOutput((prev) => [...prev, ...messages]);
      } else if (upperName.startsWith('L')) {
        const line = lines.get(upperName);
        if (!line) {
          setOutput((prev) => [...prev, `✗ Line ${upperName} not found`]);
          return;
        }

        removeLine(upperName);
        saveHistory();
        setOutput((prev) => [...prev, `✓ Deleted line ${upperName}`]);
      }
      return;
    }

    if (lowerCommand === 'list' || lowerCommand === 'ls') {
      const nodeList = Array.from(nodes.values())
        .map((n) => n.toString())
        .join('\n');
      const lineList = Array.from(lines.values())
        .map((l) => l.toString())
        .join('\n');

      setOutput((prev) => [
        ...prev,
        `Nodes (${nodes.size}):`,
        nodeList || '  (none)',
        `Lines (${lines.size}):`,
        lineList || '  (none)',
      ]);
      return;
    }

    const upperCommand = trimmed.toUpperCase();
    const nodeMatch = upperCommand.match(/^(N\d*)\[(-?\d+\.?\d*),\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]$/);
    if (nodeMatch) {
      const [, name, x, y, z] = nodeMatch;

      let nodeName = name;
      if (!nodeName || nodeName === 'N') {
        let counter = 1;
        while (nodes.has(`N${counter}`)) {
          counter++;
        }
        nodeName = `N${counter}`;
      }

      const node = new Node3D(nodeName, parseFloat(x), parseFloat(y), parseFloat(z));
      addNode(node);
      saveHistory();
      setOutput((prev) => [...prev, `✓ Created ${node.toString()}`]);
      return;
    }

    const lineMatch = upperCommand.match(/^(L\d*)\[(N?\d+),\s*(N?\d+)\]$/);
    if (lineMatch) {
      const [, name, n1Str, n2Str] = lineMatch;

      const node1Name = n1Str.startsWith('N') ? n1Str : `N${n1Str}`;
      const node2Name = n2Str.startsWith('N') ? n2Str : `N${n2Str}`;

      const node1 = nodes.get(node1Name);
      const node2 = nodes.get(node2Name);

      if (!node1 || !node2) {
        setOutput((prev) => [...prev, `✗ Error: Node ${node1Name} or ${node2Name} not found`]);
        return;
      }

      // Check if any nodes lie on the line between node1 and node2
      const intermediateNodes: Node3D[] = [];
      const tolerance = 0.001;

      for (const [nodeName, node] of nodes) {
        if (nodeName === node1Name || nodeName === node2Name) continue;

        // Calculate if node lies on the line segment
        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const dz = node2.z - node1.z;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (length < tolerance) continue;

        // Parametric form: P = P1 + t * (P2 - P1)
        // Calculate t for each dimension
        let t = -1;
        if (Math.abs(dx) > tolerance) {
          t = (node.x - node1.x) / dx;
        } else if (Math.abs(dy) > tolerance) {
          t = (node.y - node1.y) / dy;
        } else if (Math.abs(dz) > tolerance) {
          t = (node.z - node1.z) / dz;
        }

        // Check if t is valid (between 0 and 1)
        if (t < tolerance || t > 1 - tolerance) continue;

        // Verify the point matches in all dimensions
        const expectedX = node1.x + t * dx;
        const expectedY = node1.y + t * dy;
        const expectedZ = node1.z + t * dz;

        const distanceFromLine = Math.sqrt(
          Math.pow(node.x - expectedX, 2) +
          Math.pow(node.y - expectedY, 2) +
          Math.pow(node.z - expectedZ, 2)
        );

        if (distanceFromLine < tolerance) {
          intermediateNodes.push(node);
        }
      }

      // Sort intermediate nodes by distance from node1
      intermediateNodes.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.x - node1.x, 2) +
          Math.pow(a.y - node1.y, 2) +
          Math.pow(a.z - node1.z, 2)
        );
        const distB = Math.sqrt(
          Math.pow(b.x - node1.x, 2) +
          Math.pow(b.y - node1.y, 2) +
          Math.pow(b.z - node1.z, 2)
        );
        return distA - distB;
      });

      // Create line segments
      const allNodes = [node1, ...intermediateNodes, node2];
      const createdLines: string[] = [];
      const usedLineNames = new Set<string>();

      for (let i = 0; i < allNodes.length - 1; i++) {
        let lineName = name;
        if (i === 0 && name && name !== 'L') {
          // Use the provided name for the first segment only
        } else {
          let counter = 1;
          while (lines.has(`L${counter}`) || usedLineNames.has(`L${counter}`)) {
            counter++;
          }
          lineName = `L${counter}`;
        }
        usedLineNames.add(lineName);

        const line = new Line3D(lineName, allNodes[i], allNodes[i + 1]);
        addLine(line);
        createdLines.push(lineName);
      }

      saveHistory();
      if (intermediateNodes.length > 0) {
        setOutput((prev) => [
          ...prev,
          `✓ Line passes through ${intermediateNodes.length} node(s): ${intermediateNodes.map(n => n.name).join(', ')}`,
          `  Created ${createdLines.length} segments: ${createdLines.join(', ')}`,
        ]);
      } else {
        setOutput((prev) => [...prev, `✓ Created ${createdLines[0]}`]);
      }
      return;
    }

    const intersectMatch = lowerCommand.match(/^intersect\s+([a-z]?\d+)\s+([a-z]?\d+)\s+([a-z]\d+)$/);
    if (intersectMatch) {
      const [, n1Str, n2Str, lineStr] = intersectMatch;

      const node1Name = n1Str.toUpperCase().startsWith('N') ? n1Str.toUpperCase() : `N${n1Str}`;
      const node2Name = n2Str.toUpperCase().startsWith('N') ? n2Str.toUpperCase() : `N${n2Str}`;
      const lineName = lineStr.toUpperCase();

      const node1 = nodes.get(node1Name);
      const node2 = nodes.get(node2Name);
      const targetLine = lines.get(lineName);

      if (!node1 || !node2) {
        setOutput((prev) => [...prev, `✗ Error: Node ${node1Name} or ${node2Name} not found`]);
        return;
      }

      if (!targetLine) {
        setOutput((prev) => [...prev, `✗ Error: Line ${lineName} not found`]);
        return;
      }

      // Ray from node1 towards node2: P = P1 + t * direction
      // Line segment: Q = Q1 + s * (Q2 - Q1), where s in [0, 1]
      const p1 = { x: node1.x, y: node1.y, z: node1.z };
      const direction = {
        x: node2.x - node1.x,
        y: node2.y - node1.y,
        z: node2.z - node1.z
      };
      const q1 = { x: targetLine.node1.x, y: targetLine.node1.y, z: targetLine.node1.z };
      const q2 = { x: targetLine.node2.x, y: targetLine.node2.y, z: targetLine.node2.z };
      const lineDir = { x: q2.x - q1.x, y: q2.y - q1.y, z: q2.z - q1.z };

      // Solve for intersection: P1 + t * direction = Q1 + s * lineDir
      // Rearranged: t * direction - s * lineDir = Q1 - P1
      // This is a system of 3 equations (one per coordinate), but we only need 2 that are not degenerate

      const w = { x: q1.x - p1.x, y: q1.y - p1.y, z: q1.z - p1.z };

      // Use the two most significant dimensions to solve
      // We need to solve: t * direction - s * lineDir = w
      // In matrix form: [direction  -lineDir] * [t; s] = w
      let t, s;

      // Try Y-Z plane first
      const detYZ = direction.y * (-lineDir.z) - direction.z * (-lineDir.y);
      if (Math.abs(detYZ) > 0.0001) {
        // Cramer's rule
        t = (w.y * (-lineDir.z) - w.z * (-lineDir.y)) / detYZ;
        s = (direction.y * w.z - direction.z * w.y) / detYZ;
      }
      // Try X-Z plane
      else {
        const detXZ = direction.x * (-lineDir.z) - direction.z * (-lineDir.x);
        if (Math.abs(detXZ) > 0.0001) {
          t = (w.x * (-lineDir.z) - w.z * (-lineDir.x)) / detXZ;
          s = (direction.x * w.z - direction.z * w.x) / detXZ;
        }
        // Try X-Y plane
        else {
          const detXY = direction.x * (-lineDir.y) - direction.y * (-lineDir.x);
          if (Math.abs(detXY) > 0.0001) {
            t = (w.x * (-lineDir.y) - w.y * (-lineDir.x)) / detXY;
            s = (direction.x * w.y - direction.y * w.x) / detXY;
          } else {
            setOutput((prev) => [...prev, `✗ Error: Lines are parallel or coincident`]);
            return;
          }
        }
      }

      // Calculate intersection point using the line equation
      const intersectionX = q1.x + s * lineDir.x;
      const intersectionY = q1.y + s * lineDir.y;
      const intersectionZ = q1.z + s * lineDir.z;

      // Verify that the point is actually on both lines (within tolerance)
      const verifyX = p1.x + t * direction.x;
      const verifyY = p1.y + t * direction.y;
      const verifyZ = p1.z + t * direction.z;

      const distance = Math.sqrt(
        Math.pow(intersectionX - verifyX, 2) +
        Math.pow(intersectionY - verifyY, 2) +
        Math.pow(intersectionZ - verifyZ, 2)
      );

      // For skew lines, use the closest point on L1 to the line N4→N7
      let finalX = intersectionX;
      let finalY = intersectionY;
      let finalZ = intersectionZ;
      let isSkewLines = false;
      let finalS = s;

      if (distance > 0.01) {
        isSkewLines = true;
        // Use the s parameter we calculated (closest point on L1)
        // Clamp to segment
        finalS = Math.max(0, Math.min(1, s));
        finalX = q1.x + finalS * lineDir.x;
        finalY = q1.y + finalS * lineDir.y;
        finalZ = q1.z + finalS * lineDir.z;
      }

      // Find next available node name
      let counter = 1;
      while (nodes.has(`N${counter}`)) {
        counter++;
      }
      const newNodeName = `N${counter}`;
      const usedNodeNames = new Set<string>([newNodeName]);

      // Create new node at intersection/closest point
      const newNode = new Node3D(newNodeName, finalX, finalY, finalZ);
      addNode(newNode);

      // Take a snapshot of existing lines BEFORE we start modifying
      const existingLinesSnapshot = Array.from(lines.entries());
      const targetLineShouldBeSplit = !isSkewLines && finalS >= 0 && finalS <= 1;
      let targetLineWasSplit = false;

      // Track all line names we create to avoid collisions
      const createdLineNames = new Set<string>();

      // We'll split the target line later along with other intersected lines

      // Check if line from node1 to newNode passes through any existing nodes or lines
      const intermediateNodes: Node3D[] = [];
      const tolerance = 0.001;

      // Check for existing nodes on the line
      for (const [nodeName, node] of nodes) {
        if (nodeName === node1Name || nodeName === newNodeName) continue;

        const dx = newNode.x - node1.x;
        const dy = newNode.y - node1.y;
        const dz = newNode.z - node1.z;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (length < tolerance) continue;

        let t = -1;
        if (Math.abs(dx) > tolerance) {
          t = (node.x - node1.x) / dx;
        } else if (Math.abs(dy) > tolerance) {
          t = (node.y - node1.y) / dy;
        } else if (Math.abs(dz) > tolerance) {
          t = (node.z - node1.z) / dz;
        }

        if (t < tolerance || t > 1 - tolerance) continue;

        const expectedX = node1.x + t * dx;
        const expectedY = node1.y + t * dy;
        const expectedZ = node1.z + t * dz;

        const distanceFromLine = Math.sqrt(
          Math.pow(node.x - expectedX, 2) +
          Math.pow(node.y - expectedY, 2) +
          Math.pow(node.z - expectedZ, 2)
        );

        if (distanceFromLine < tolerance) {
          intermediateNodes.push(node);
        }
      }

      // Check for intersections with existing lines
      const newLineDir = { x: newNode.x - node1.x, y: newNode.y - node1.y, z: newNode.z - node1.z };
      const newLineLength = Math.sqrt(newLineDir.x ** 2 + newLineDir.y ** 2 + newLineDir.z ** 2);
      const linesToSplit: Array<{ line: Line3D; lineName: string; node: Node3D }> = [];

      for (const [existingLineName, existingLine] of existingLinesSnapshot) {
        // Skip the target line since we already handled it
        if (existingLineName === lineName) continue;
        const lp1 = { x: node1.x, y: node1.y, z: node1.z };
        const lq1 = { x: existingLine.node1.x, y: existingLine.node1.y, z: existingLine.node1.z };
        const lq2 = { x: existingLine.node2.x, y: existingLine.node2.y, z: existingLine.node2.z };
        const existingLineDir = { x: lq2.x - lq1.x, y: lq2.y - lq1.y, z: lq2.z - lq1.z };

        const lw = { x: lq1.x - lp1.x, y: lq1.y - lp1.y, z: lq1.z - lp1.z };

        let lt, ls;
        const ldetYZ = newLineDir.y * (-existingLineDir.z) - newLineDir.z * (-existingLineDir.y);
        if (Math.abs(ldetYZ) > 0.0001) {
          lt = (lw.y * (-existingLineDir.z) - lw.z * (-existingLineDir.y)) / ldetYZ;
          ls = (newLineDir.y * lw.z - newLineDir.z * lw.y) / ldetYZ;
        } else {
          const ldetXZ = newLineDir.x * (-existingLineDir.z) - newLineDir.z * (-existingLineDir.x);
          if (Math.abs(ldetXZ) > 0.0001) {
            lt = (lw.x * (-existingLineDir.z) - lw.z * (-existingLineDir.x)) / ldetXZ;
            ls = (newLineDir.x * lw.z - newLineDir.z * lw.x) / ldetXZ;
          } else {
            const ldetXY = newLineDir.x * (-existingLineDir.y) - newLineDir.y * (-existingLineDir.x);
            if (Math.abs(ldetXY) > 0.0001) {
              lt = (lw.x * (-existingLineDir.y) - lw.y * (-existingLineDir.x)) / ldetXY;
              ls = (newLineDir.x * lw.y - newLineDir.y * lw.x) / ldetXY;
            } else {
              continue; // Parallel or coincident
            }
          }
        }

        // Check if intersection is within both line segments
        if (lt > tolerance && lt < 1 - tolerance && ls > tolerance && ls < 1 - tolerance) {
          const intersectX = lq1.x + ls * existingLineDir.x;
          const intersectY = lq1.y + ls * existingLineDir.y;
          const intersectZ = lq1.z + ls * existingLineDir.z;

          // Verify it's actually on both lines
          const verifyX = lp1.x + lt * newLineDir.x;
          const verifyY = lp1.y + lt * newLineDir.y;
          const verifyZ = lp1.z + lt * newLineDir.z;

          const dist = Math.sqrt(
            Math.pow(intersectX - verifyX, 2) +
            Math.pow(intersectY - verifyY, 2) +
            Math.pow(intersectZ - verifyZ, 2)
          );

          if (dist < 0.01) {
            // Create a new node at this intersection
            let nodeCounter = 1;
            while (nodes.has(`N${nodeCounter}`) || usedNodeNames.has(`N${nodeCounter}`)) {
              nodeCounter++;
            }
            const intersectNodeName = `N${nodeCounter}`;
            usedNodeNames.add(intersectNodeName);

            const intersectNode = new Node3D(intersectNodeName, intersectX, intersectY, intersectZ);
            addNode(intersectNode);
            intermediateNodes.push(intersectNode);

            // Mark this line to be split
            linesToSplit.push({ line: existingLine, lineName: existingLineName, node: intersectNode });
          }
        }
      }

      // Split the target line if needed
      if (targetLineShouldBeSplit) {
        const distToNode1 = Math.sqrt(
          Math.pow(finalX - targetLine.node1.x, 2) +
          Math.pow(finalY - targetLine.node1.y, 2) +
          Math.pow(finalZ - targetLine.node1.z, 2)
        );
        const distToNode2 = Math.sqrt(
          Math.pow(finalX - targetLine.node2.x, 2) +
          Math.pow(finalY - targetLine.node2.y, 2) +
          Math.pow(finalZ - targetLine.node2.z, 2)
        );

        if (distToNode1 > 0.001 && distToNode2 > 0.001) {
          removeLine(lineName);

          let splitLineCounter1 = 1;
          while (lines.has(`L${splitLineCounter1}`) || createdLineNames.has(`L${splitLineCounter1}`)) {
            splitLineCounter1++;
          }
          const splitLine1Name = `L${splitLineCounter1}`;
          createdLineNames.add(splitLine1Name);
          const splitLine1 = new Line3D(splitLine1Name, targetLine.node1, newNode);
          addLine(splitLine1);

          let splitLineCounter2 = splitLineCounter1 + 1;
          while (lines.has(`L${splitLineCounter2}`) || createdLineNames.has(`L${splitLineCounter2}`)) {
            splitLineCounter2++;
          }
          const splitLine2Name = `L${splitLineCounter2}`;
          createdLineNames.add(splitLine2Name);
          const splitLine2 = new Line3D(splitLine2Name, newNode, targetLine.node2);
          addLine(splitLine2);
          targetLineWasSplit = true;
        }
      }

      // Split the lines that were intersected
      for (const { line, lineName: lineToSplitName, node: splitNode } of linesToSplit) {
        removeLine(lineToSplitName);

        let splitLineCounter1 = 1;
        while (lines.has(`L${splitLineCounter1}`) || createdLineNames.has(`L${splitLineCounter1}`)) {
          splitLineCounter1++;
        }
        const splitLine1Name = `L${splitLineCounter1}`;
        createdLineNames.add(splitLine1Name);
        const splitLine1 = new Line3D(splitLine1Name, line.node1, splitNode);
        addLine(splitLine1);

        let splitLineCounter2 = splitLineCounter1 + 1;
        while (lines.has(`L${splitLineCounter2}`) || createdLineNames.has(`L${splitLineCounter2}`)) {
          splitLineCounter2++;
        }
        const splitLine2Name = `L${splitLineCounter2}`;
        createdLineNames.add(splitLine2Name);
        const splitLine2 = new Line3D(splitLine2Name, splitNode, line.node2);
        addLine(splitLine2);
      }

      // Sort intermediate nodes by distance from node1
      intermediateNodes.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.x - node1.x, 2) +
          Math.pow(a.y - node1.y, 2) +
          Math.pow(a.z - node1.z, 2)
        );
        const distB = Math.sqrt(
          Math.pow(b.x - node1.x, 2) +
          Math.pow(b.y - node1.y, 2) +
          Math.pow(b.z - node1.z, 2)
        );
        return distA - distB;
      });

      // Create line segments
      const allNodesInPath = [node1, ...intermediateNodes, newNode];
      const createdLines: string[] = [];

      for (let i = 0; i < allNodesInPath.length - 1; i++) {
        let lineCounter = 1;
        while (lines.has(`L${lineCounter}`) || createdLineNames.has(`L${lineCounter}`)) {
          lineCounter++;
        }
        const newLineName = `L${lineCounter}`;
        createdLineNames.add(newLineName);

        const newLine = new Line3D(newLineName, allNodesInPath[i], allNodesInPath[i + 1]);
        addLine(newLine);
        createdLines.push(newLineName);
      }

      const isOutsideSegment = !isSkewLines && (s < 0 || s > 1);

      saveHistory();

      const messages = [
        `✓ Created ${isSkewLines ? 'closest point' : 'intersection'} node ${newNodeName} at (${finalX.toFixed(2)}, ${finalY.toFixed(2)}, ${finalZ.toFixed(2)})`,
      ];

      if (targetLineWasSplit) {
        messages.push(`✓ Split ${lineName} at ${newNodeName}`);
      }

      if (linesToSplit.length > 0) {
        messages.push(`✓ Split ${linesToSplit.length} intersected line(s)`);
      }

      if (intermediateNodes.length > 0) {
        messages.push(`✓ Path passes through ${intermediateNodes.length} intermediate point(s): ${intermediateNodes.map(n => n.name).join(', ')}`);
        messages.push(`✓ Created ${createdLines.length} line segment(s) from ${node1Name} to ${newNodeName}: ${createdLines.join(', ')}`);
      } else {
        messages.push(`✓ Created line ${createdLines[0]} from ${node1Name} to ${newNodeName}`);
      }

      if (isSkewLines) {
        messages.push(`  Note: Lines are skew (don't intersect), created closest point on ${lineName}`);
      } else if (isOutsideSegment) {
        messages.push(`  Note: Intersection required extending line ${lineName} (s=${s.toFixed(3)})`);
      }

      setOutput((prev) => [...prev, ...messages]);
      return;
    }

    // Check if command is just a node or line name
    const infoMatch = upperCommand.match(/^([NL]\d+)$/);
    if (infoMatch) {
      const name = infoMatch[1];

      if (name.startsWith('N')) {
        const node = nodes.get(name);
        if (node) {
          setOutput((prev) => [
            ...prev,
            `Node ${name}:`,
            `  Position: (${node.x}, ${node.y}, ${node.z})`,
            `  Coordinates: x=${node.x}, y=${node.y}, z=${node.z}`,
          ]);
        } else {
          setOutput((prev) => [...prev, `✗ Node ${name} not found`]);
        }
      } else if (name.startsWith('L')) {
        const line = lines.get(name);
        if (line) {
          const length = line.length;
          setOutput((prev) => [
            ...prev,
            `Line ${name}:`,
            `  Connects: ${line.node1.name} → ${line.node2.name}`,
            `  Node 1: (${line.node1.x}, ${line.node1.y}, ${line.node1.z})`,
            `  Node 2: (${line.node2.x}, ${line.node2.y}, ${line.node2.z})`,
            `  Length: ${length.toFixed(3)}m`,
          ]);
        } else {
          setOutput((prev) => [...prev, `✗ Line ${name} not found`]);
        }
      }
      return;
    }

    const splitMatch = lowerCommand.match(/^split\s+([a-z]\d+)\s+(\d+)$/);
    if (splitMatch) {
      const [, lineName, partsStr] = splitMatch;
      const parts = parseInt(partsStr);
      const lineNameUpper = lineName.toUpperCase();

      if (parts < 2) {
        setOutput((prev) => [...prev, '✗ Number of parts must be at least 2']);
        return;
      }

      const line = lines.get(lineNameUpper);
      if (!line) {
        setOutput((prev) => [...prev, `✗ Error: Line ${lineNameUpper} not found`]);
        return;
      }

      const { node1, node2 } = line;
      const newNodes: Node3D[] = [];
      const usedNodeNames = new Set<string>();
      const usedLineNames = new Set<string>();

      // Create intermediate nodes
      for (let i = 1; i < parts; i++) {
        const t = i / parts;
        const x = node1.x + (node2.x - node1.x) * t;
        const y = node1.y + (node2.y - node1.y) * t;
        const z = node1.z + (node2.z - node1.z) * t;

        // Find next available node name
        let counter = 1;
        while (nodes.has(`N${counter}`) || usedNodeNames.has(`N${counter}`)) {
          counter++;
        }
        const nodeName = `N${counter}`;
        usedNodeNames.add(nodeName);

        const newNode = new Node3D(nodeName, x, y, z);
        addNode(newNode);
        newNodes.push(newNode);
      }

      // Remove original line
      removeLine(lineNameUpper);

      // Create new line segments
      const allNodes = [node1, ...newNodes, node2];
      const createdLines: string[] = [];

      for (let i = 0; i < allNodes.length - 1; i++) {
        let counter = 1;
        while (lines.has(`L${counter}`) || usedLineNames.has(`L${counter}`)) {
          counter++;
        }
        const newLineName = `L${counter}`;
        usedLineNames.add(newLineName);

        const newLine = new Line3D(newLineName, allNodes[i], allNodes[i + 1]);
        addLine(newLine);
        createdLines.push(newLineName);
      }

      saveHistory();
      setOutput((prev) => [
        ...prev,
        `✓ Split ${lineNameUpper} into ${parts} parts`,
        `  Created ${newNodes.length} nodes: ${newNodes.map(n => n.name).join(', ')}`,
        `  Created ${createdLines.length} lines: ${createdLines.join(', ')}`,
      ]);
      return;
    }

    setOutput((prev) => [...prev, `✗ Unknown command: ${trimmed}`]);
  };

  return (
    <div className="flex flex-col h-screen">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileLoad}
        className="hidden"
      />

      <header className="bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Craftea Editor</h1>

        <div className="flex gap-2">
          <button
            onClick={() => undo()}
            disabled={!canUndo()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            onClick={() => redo()}
            disabled={!canRedo()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
          <button
            onClick={() => {
              set2DMode(!is2DMode);
              setOutput((prev) => [...prev, `✓ Switched to ${!is2DMode ? '2D' : '3D'} mode`]);
            }}
            className={`px-4 py-2 ${is2DMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded transition-colors font-semibold`}
            title={is2DMode ? 'Switch to 3D mode (X,Y,Z)' : 'Switch to 2D mode (Z=0)'}
          >
            {is2DMode ? '📐 2D' : '🧊 3D'}
          </button>
          <button
            onClick={handleLoadClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Load
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
          >
            Save
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <Viewport3D />
        </div>

        <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 font-mono text-sm text-gray-300">
            {output.length === 0 ? (
              <div className="text-gray-500">
                <p>Welcome to Craftea!</p>
                <p className="mt-2">Type commands or ask AI in natural language</p>
                <p className="mt-4">Commands:</p>
                <ul className="mt-2 space-y-1">
                  <li>• N1[0,0,0] - Create node</li>
                  <li>• L1[1,2] - Create line</li>
                  <li>• list - Show all</li>
                  <li>• help - Show commands</li>
                </ul>
                <p className="mt-4">Or ask AI:</p>
                <ul className="mt-2 space-y-1">
                  <li>• &quot;create a cube 3x3&quot;</li>
                  <li>• &quot;make a pyramid&quot;</li>
                  <li>• &quot;show me all nodes&quot;</li>
                </ul>
              </div>
            ) : (
              output.map((line, i) => (
                <div key={i} className="mb-1 whitespace-pre-wrap">
                  {line}
                </div>
              ))
            )}
            {isAIProcessing && (
              <div className="mt-2 flex items-center gap-3">
                <div className="text-blue-400 animate-pulse">
                  🤖 AI is thinking...
                </div>
                <button
                  onClick={() => {
                    abortControllerRef.current?.abort();
                    setIsAIProcessing(false);
                    setOutput((prev) => [...prev, '✗ Request cancelled by user']);
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors font-semibold"
                  title="Stop the current AI request"
                >
                  ⏹ Stop
                </button>
              </div>
            )}
            {pendingPlan && (
              <div key={pendingPlan.timestamp} className="mt-4 p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-2 border-blue-500 rounded-lg shadow-lg animate-[fadeIn_0.3s_ease-in]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📋</span>
                  <div className="text-blue-300 font-bold text-lg">Plan Ready for Approval</div>
                  <span className="text-xs text-gray-500 ml-auto">#{pendingPlan.timestamp}</span>
                </div>
                <div className="text-gray-300 text-sm mb-4">
                  Review the plan above and choose an action:
                </div>
                <div className="flex gap-3">
                  <button
                    data-action="approve"
                    onClick={() => {
                      console.log('🖱️ [BUTTON] Approve button clicked');
                      handleCommand('yes');
                    }}
                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl">✓</span>
                      <span>Approve</span>
                    </div>
                    <div className="text-xs text-green-200 mt-1">Press Y or Enter</div>
                  </button>
                  <button
                    data-action="reject"
                    onClick={() => {
                      console.log('🖱️ [BUTTON] Reject button clicked');
                      handleCommand('no');
                    }}
                    className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl">✗</span>
                      <span>Reject</span>
                    </div>
                    <div className="text-xs text-red-200 mt-1">Press N or Esc</div>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-700">
            <CommandInput onCommand={handleCommand} disabled={isAIProcessing} />
          </div>
        </div>
      </div>
    </div>
  );
}
