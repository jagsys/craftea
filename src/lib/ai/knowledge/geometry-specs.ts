/**
 * GEOMETRY KNOWLEDGE BASE
 *
 * Reference data for letters, shapes, and structures.
 * This data can be loaded dynamically and injected only when needed,
 * instead of living in the system prompt.
 */

export interface StructureSpec {
  name: string;
  minNodes: number;
  minEdges: number;
  description: string;
  nodes?: string[];
  edges?: string[];
  example?: {
    coordinates: [number, number, number][];
    connections: [string, string][];
  };
  ascii?: string;
}

/**
 * 2D Letter Specifications
 */
export const LETTER_SPECS: Record<string, StructureSpec> = {
  A: {
    name: 'Letter A',
    minNodes: 5,
    minEdges: 5,
    description: 'Two diagonal strokes meeting at top + horizontal crossbar',
    nodes: ['bottom-left', 'bottom-right', 'top apex', 'crossbar-left', 'crossbar-right'],
    example: {
      coordinates: [[0,0,0], [2,0,0], [1,2,0], [0.5,1,0], [1.5,1,0]],
      connections: [['bottom-left','apex'], ['apex','bottom-right'], ['crossbar-left','crossbar-right']],
    },
    ascii: '  /\\\n /  \\\n/----\\\n/      \\',
  },

  E: {
    name: 'Letter E',
    minNodes: 6,
    minEdges: 5,
    description: 'Vertical stroke + three horizontal arms (top, middle, bottom)',
    nodes: ['bottom-left', 'top-left', 'bottom-right', 'middle-left', 'middle-right', 'top-right'],
    example: {
      coordinates: [[0,0,0], [0,2,0], [1,0,0], [0,1,0], [1,1,0], [1,2,0]],
      connections: [['bottom-left','middle-left'], ['middle-left','top-left'], ['bottom-left','bottom-right'], ['middle-left','middle-right'], ['top-left','top-right']],
    },
    ascii: '|____\n|    \n|____\n|    \n|____',
  },

  H: {
    name: 'Letter H',
    minNodes: 6,
    minEdges: 5,
    description: 'Two parallel verticals + horizontal crossbar',
    nodes: ['left-bottom', 'left-top', 'right-bottom', 'right-top', 'crossbar-left', 'crossbar-right'],
    ascii: '| |\n|__|\n|  |',
  },

  I: {
    name: 'Letter I',
    minNodes: 2,
    minEdges: 1,
    description: 'Single vertical line',
    nodes: ['top', 'bottom'],
    example: {
      coordinates: [[0,2,0], [0,0,0]],
      connections: [['top','bottom']],
    },
    ascii: '|\n|\n|',
  },

  K: {
    name: 'Letter K',
    minNodes: 5,
    minEdges: 4,
    description: 'Vertical stroke + two diagonals meeting at middle junction',
    nodes: ['bottom', 'top', 'middle', 'upper-right', 'lower-right'],
    example: {
      coordinates: [[0,0,0], [0,2,0], [0,1,0], [1,2,0], [1,0,0]],
      connections: [['bottom','middle'], ['middle','top'], ['middle','upper-right'], ['middle','lower-right']],
    },
    ascii: '|  /\n| /\n|<\n| \\\n|  \\',
  },

  L: {
    name: 'Letter L',
    minNodes: 3,
    minEdges: 2,
    description: 'Vertical stroke + horizontal base',
    nodes: ['top', 'bottom-left', 'bottom-right'],
    ascii: '|\n|\n|___',
  },

  M: {
    name: 'Letter M',
    minNodes: 5,
    minEdges: 4,
    description: 'Two verticals with V-shaped valley in the middle',
    nodes: ['bottom-left', 'top-left', 'middle-valley', 'top-right', 'bottom-right'],
    example: {
      coordinates: [[0,0,0], [0,2,0], [1,1,0], [2,2,0], [2,0,0]],
      connections: [['bottom-left','top-left'], ['top-left','valley'], ['valley','top-right'], ['top-right','bottom-right']],
    },
    ascii: '|\\  /|\n| \\/ |\n|    |',
  },

  N: {
    name: 'Letter N',
    minNodes: 4,
    minEdges: 3,
    description: 'Two verticals connected by one diagonal',
    nodes: ['bottom-left', 'top-left', 'bottom-right', 'top-right'],
    ascii: '|\\  |\n| \\ |\n|  \\|',
  },

  O: {
    name: 'Letter O',
    minNodes: 4,
    minEdges: 4,
    description: 'Closed rectangle forming a loop',
    nodes: ['bottom-left', 'bottom-right', 'top-right', 'top-left'],
    example: {
      coordinates: [[0,0,0], [1,0,0], [1,2,0], [0,2,0]],
      connections: [['bottom-left','bottom-right'], ['bottom-right','top-right'], ['top-right','top-left'], ['top-left','bottom-left']],
    },
    ascii: ' ___\n|   |\n|   |\n|___|',
  },

  T: {
    name: 'Letter T',
    minNodes: 4,
    minEdges: 3,
    description: 'Horizontal top bar + vertical stem',
    nodes: ['top-left', 'top-right', 'center-top', 'bottom'],
    ascii: '___\n |\n |',
  },

  V: {
    name: 'Letter V',
    minNodes: 3,
    minEdges: 2,
    description: 'Two diagonals meeting at bottom',
    nodes: ['top-left', 'bottom-apex', 'top-right'],
    ascii: '\\  /\n \\/ ',
  },

  W: {
    name: 'Letter W',
    minNodes: 5,
    minEdges: 4,
    description: 'Inverted M with two valleys',
    nodes: ['top-left', 'bottom-left-valley', 'middle-peak', 'bottom-right-valley', 'top-right'],
    ascii: '\\/  \\/\n /\\\\\n/  \\',
  },

  X: {
    name: 'Letter X',
    minNodes: 5,
    minEdges: 4,
    description: 'Two diagonals crossing at center',
    nodes: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center-intersection'],
    ascii: '\\  /\n \\/ \n /\\ \n/  \\',
  },

  Y: {
    name: 'Letter Y',
    minNodes: 4,
    minEdges: 3,
    description: 'Two upper diagonals meeting + one lower vertical',
    nodes: ['top-left', 'top-right', 'middle-junction', 'bottom'],
    ascii: '\\  /\n \\/ \n  |\n  |',
  },
};

/**
 * 3D Shape Specifications
 */
export const SHAPE_SPECS: Record<string, StructureSpec> = {
  cube: {
    name: 'Cube',
    minNodes: 8,
    minEdges: 12,
    description: '8 vertices, 12 edges, 6 square faces. All edges equal length.',
    nodes: ['4 bottom corners', '4 top corners'],
    edges: ['4 bottom edges', '4 top edges', '4 vertical edges'],
  },

  house: {
    name: 'House',
    minNodes: 9,
    minEdges: 16,
    description: 'Rectangular prism (walls) + triangular roof on top. NOT a pyramid!',
    nodes: ['4 base corners at y=0', '4 top-of-wall corners at y=wall_height', '1 roof apex at y=wall_height+roof_height'],
    edges: ['4 base edges', '4 top edges', '4 vertical wall edges', '4 roof edges from top corners to apex'],
  },

  pyramid: {
    name: 'Square Pyramid',
    minNodes: 5,
    minEdges: 8,
    description: 'Square base + apex above center',
    nodes: ['4 base corners', '1 apex'],
    edges: ['4 base edges', '4 edges from base to apex'],
  },

  tetrahedron: {
    name: 'Tetrahedron',
    minNodes: 4,
    minEdges: 6,
    description: '4 vertices, 6 edges, 4 triangular faces. All faces are equilateral triangles.',
    nodes: ['4 vertices where each connects to all others'],
  },
};

/**
 * Get specification for a specific letter
 */
export function getLetterSpec(letter: string): StructureSpec | null {
  return LETTER_SPECS[letter.toUpperCase()] || null;
}

/**
 * Get specification for a specific shape
 */
export function getShapeSpec(shape: string): StructureSpec | null {
  return SHAPE_SPECS[shape.toLowerCase()] || null;
}

/**
 * Get minimum node requirements for a word
 */
export function getWordRequirements(word: string): {
  totalMinNodes: number;
  letterBreakdown: { letter: string; minNodes: number }[];
  suggestedSpacing: string;
} {
  const letterBreakdown: { letter: string; minNodes: number }[] = [];
  let totalMinNodes = 0;
  const letters = word.toUpperCase().split('');

  letters.forEach((letter) => {
    const spec = getLetterSpec(letter);
    const minNodes = spec ? spec.minNodes : 4; // Default 4 if unknown
    letterBreakdown.push({ letter, minNodes });
    totalMinNodes += minNodes;
  });

  // Generate suggested spacing (2-unit gap between letters)
  let currentX = 0;
  const spacing = letters.map((letter, i) => {
    const width = 1.5; // Approximate letter width
    const result = `${letter} at x=${currentX.toFixed(1)}-${(currentX + width).toFixed(1)}`;
    currentX += width + 1.5; // Add gap
    return result;
  }).join(', ');

  return {
    totalMinNodes,
    letterBreakdown,
    suggestedSpacing: spacing,
  };
}
