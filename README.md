# Craftea

Web-based 3D structure design tool - a modern reimplementation of LineCraft with a web interface.

## Overview

Craftea is a 3D structure design tool that allows you to create and visualize 3D structures using nodes and lines. It features:

- **3D Visualization**: Interactive Three.js-powered 3D viewport with orbit controls
- **Command-based Interface**: Terminal-like command input for quick structure creation
- **Project Management**: Save and load projects with SQLite database
- **Real-time Updates**: Instant visualization of your structures

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **3D Graphics**: Three.js, React Three Fiber, React Three Drei
- **Database**: SQLite with Drizzle ORM
- **State Management**: Zustand
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: Node.js 20+)
- pnpm (install with: `npm install -g pnpm`)

### Installation

1. Clone the repository:
```bash
cd craftea
```

2. Install dependencies (this will automatically build native dependencies):
```bash
pnpm install
```

3. Run database migrations:
```bash
pnpm dlx tsx src/lib/db/migrate.ts
```

4. Start the development server:
```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

> **Note:** If you encounter issues with better-sqlite3, you can manually rebuild it:
> ```bash
> cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npm run build-release && cd -
> ```

## Usage

### Basic Commands

Navigate to the Editor page and use the command input to create structures:

- `N1[0,0,0]` - Create a node named N1 at coordinates (0, 0, 0)
- `N2[3,0,0]` - Create a node named N2 at coordinates (3, 0, 0)
- `L1[1,2]` - Create a line connecting N1 and N2
- `list` or `ls` - List all nodes and lines
- `clear` - Clear the scene

### Auto-naming

You can omit the name for auto-generated names:
- `N[0,0,0]` - Creates N1, N2, N3, etc.
- `L[1,2]` - Creates L1, L2, L3, etc.

### 3D Viewport Controls

- **Orbit**: Left-click + drag
- **Pan**: Right-click + drag
- **Zoom**: Mouse wheel

## Project Structure

```
craftea/
├── src/
│   ├── app/                  # Next.js pages and API routes
│   ├── components/           # React components
│   │   ├── editor/          # Editor-specific components
│   │   └── ui/              # Reusable UI components
│   ├── lib/
│   │   ├── core/            # Core algorithms (Node3D, Line3D, Projection3D)
│   │   ├── db/              # Database schema and client
│   │   ├── parsers/         # Command parsing logic
│   │   └── stores/          # Zustand state management
│   └── types/               # TypeScript type definitions
├── public/                  # Static assets
└── craftea.db              # SQLite database (generated)
```

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio (database GUI)

### Database

The project uses SQLite with Drizzle ORM. The database schema includes:

- **projects**: Project metadata
- **nodes**: 3D nodes with coordinates
- **lines**: Lines connecting nodes

Migrations are stored in `src/lib/db/migrations/`.

## Roadmap

### Phase 1 (Current)
- ✅ Basic 3D visualization
- ✅ Node and line creation
- ✅ Command-based interface
- ⏳ API routes for CRUD operations
- ⏳ Advanced command parser
- ⏳ Shape detection algorithm

### Phase 2 (Planned)
- Project save/load UI
- Undo/redo functionality
- Calculator integration
- Vector operations (batch node creation)
- Area and distance measurements

### Phase 3 (Future)
- User authentication
- Project sharing
- Collaborative editing
- Export to various formats (SVG, PDF, 3D models)
- Project templates

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

MIT

## Original Project

Based on [LineCraft](../LineCraft) - a terminal-based 3D structure design tool.
