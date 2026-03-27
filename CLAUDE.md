# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Bridge is a dynamic MCP (Model Context Protocol) service bridge that enables runtime registration of MCP tools. It acts as a middleware between MCP clients (like Claude Code) and frontend applications, allowing tools to be dynamically registered and executed via WebSocket.

## Commands

```bash
# Development (starts server on port 3000 with hot reload)
npm run dev

# Build (server + web UI)
npm run build

# Build server only
npm run build:server

# Build web UI only
npm run build:web

# Production start
npm start

# Run tests
npm test

# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_BRIDGE_PORT` | `3000` | Server port |
| `MCP_BRIDGE_URL` | `http://localhost:3000` | Server URL (for MCP config generation) |
| `MCP_NAME` | `mcp-bridge` | MCP service name |

## Architecture

```
src/
├── index.ts              # Entry point: initializes all components
├── config.ts             # Configuration from env vars
├── core/                 # Core engine (no external dependencies)
│   ├── types.ts          # All TypeScript interfaces
│   ├── registry.ts       # ToolRegistry: CRUD operations on tools
│   ├── executor.ts       # ToolExecutor: handles tool invocation
│   └── schemas.ts        # Zod validation schemas
├── transport/            # Protocol implementations
│   ├── sse.ts            # MCP SSE endpoint for Claude Code
│   ├── websocket.ts      # WSClientManager: client lifecycle
│   ├── ws-handler.ts     # Message routing for WebSocket
│   └── ws-route.ts       # WebSocket route helpers
├── api/                  # HTTP REST API
│   └── tools.ts          # /api/tools CRUD + invoke
└── web/                  # React frontend (Vite dev server on :5173)
```

## Key Design Patterns

### Core Components (Dependency Injection)

The main components are instantiated in `index.ts` and passed to routes/handlers:

```typescript
const registry = new ToolRegistry(config.serverUrl, config.mcp.name)
const clientManager = new WSClientManager(config.websocket.heartbeat)
const executor = new ToolExecutor(registry, clientManager)
const eventEmitter = new EventEmitter()
```

### Tool Execution Flow

1. MCP Client calls tool via SSE → `sse.ts` receives request
2. `executor.execute(toolName, args)` is called
3. Executor finds WebSocket clients with matching capability
4. Sends `tool_request` message to client(s)
5. Client executes and returns `tool_response`
6. Executor resolves promise and returns result to MCP client

### WebSocket Message Types

See `src/core/types.ts` for all message interfaces. Key flow:
- Client sends `register` with `capabilities` (tool names it can execute)
- Server sends `tool_request` when tool is invoked
- Client sends `tool_response` with result

### Tool Handler Types

Currently only `websocket` handler is fully implemented. The handler determines how tool execution is dispatched:

```typescript
handler: {
  type: 'websocket',
  action?: string,        // Client-side action identifier
  timeout?: number,       // Default 30000ms
  target?: 'all' | 'first' | 'specific',
  clientId?: string       // For 'specific' target
}
```

## MCP Configuration

To connect Claude Code, the MCP settings file should contain:

```json
{
  "mcpServers": {
    "mcp-bridge": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

## Testing Tools

```bash
# List registered tools
curl http://localhost:3000/api/tools

# Test tool invocation (requires WebSocket client connected)
curl -X POST http://localhost:3000/api/tools/<tool_name>/invoke \
  -H "Content-Type: application/json" \
  -d '{"arg1": "value1"}'
```

## Data Storage

Currently uses in-memory `Map` storage. Tool definitions are lost on server restart. Future versions will support SQLite/Redis persistence.

## Web UI

The React web UI is located in `src/web/`. During development, Vite runs on port 5173 with proxy to the main server. The UI can:
- Register/edit/delete tools via HTTP API
- Connect via WebSocket to handle tool execution requests
- Subscribe to tool events

## Documentation

- `docs/requirements/` - Requirements documents
  - `management-platform.md` - Management platform requirements (Tool management, Logs, Skill orchestration)