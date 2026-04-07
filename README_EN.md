# MCP Bridge

A dynamic MCP (Model Context Protocol) service bridge that supports dynamic registration of MCP capabilities via Web UI or API, with SSE protocol support and bidirectional communication between MCP clients and frontends.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm run dev

# 3. Open http://localhost:3000/sdk/simple.html to register tools

# 4. Configure in .mcp/settings.json
```

```json
// .mcp/settings.json
{
  "mcpServers": {
    "mcp-bridge": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

## Core Features

### 1. Dynamic MCP Capability Registration
- **Tools**: Dynamically register tool functions that can be called by MCP clients ✅
- **Skills**: Visual workflow orchestration with conditional branching and multi-tool composition ✅
- **Resources**: Dynamically register readable resources (planned)
- **Prompts**: Dynamically register predefined prompt templates (planned)

### 2. Protocol Support
- **SSE (HTTP)**: Remote/Web access, compatible with network clients like Claude Code ✅
- **stdio**: Local process communication (planned)

### 3. Bidirectional Communication
- Web UI registers tools via HTTP API
- When MCP Client (Claude) calls a tool, MCP Bridge notifies Web UI via WebSocket
- Web UI executes and returns results, MCP Bridge forwards to Claude

### 4. Core Invocation Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Web UI  │      │   MCP    │      │   MCP    │      │  Claude  │
│          │      │  Bridge  │      │  Server  │      │ Desktop │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │
     │  1. Register    │                 │                 │
     │ ───────────────▶│                 │                 │
     │                 │                 │                 │
     │                 │                 │   2. Call tool  │
     │                 │                 │ ◀───────────────│
     │                 │                 │                 │
     │                 │  3. Forward req │                 │
     │                 │ ◀───────────────│                 │
     │                 │                 │                 │
     │  4. tool_request│                 │                 │
     │ ◀───────────────│                 │                 │
     │                 │                 │                 │
     │  5. Execute     │                 │                 │
     │  (user/business)│                 │                 │
     │                 │                 │                 │
     │  6. tool_response│                │                 │
     │ ───────────────▶│                 │                 │
     │                 │                 │                 │
     │                 │  7. Return      │                 │
     │                 │ ───────────────▶│                 │
     │                 │                 │                 │
     │                 │                 │  8. To Claude   │
     │                 │                 │ ───────────────▶│
     │                 │                 │                 │
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ (ESM) |
| Backend Framework | Hono |
| MCP SDK | @modelcontextprotocol/sdk |
| WebSocket | Built-in Hono |
| Storage | Memory cache (Map), upgradeable to SQLite/Redis |
| Frontend | React 18 + Vite + TypeScript |
| Containerization | Docker multi-stage build |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MCP Bridge Server                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │   Transport     │  │   Core Engine   │  │    Push Service     │ │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────────┤ │
│  │ • stdio server  │  │ • Tool Registry │  │ • WebSocket Server   │ │
│  │ • SSE server    │  │ • Resource Mgr  │  │ • Event Emitter     │ │
│  │ • HTTP API      │  │ • Prompt Store  │  │ • Subscription Mgr  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│           │                   │                      │             │
│           └───────────────────┼──────────────────────┘             │
│                               ▼                                    │
│                    ┌─────────────────────┐                         │
│                    │   Storage Layer     │                         │
│                    │  (Memory Cache)     │                         │
│                    └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
        │                                           │
        ▼                                           ▼
┌───────────────┐                         ┌─────────────────┐
│ MCP Clients   │                         │   WebSocket     │
│ (Claude etc)  │                         │   Endpoints     │
└───────────────┘                         └────────┬────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    │              │              │
                              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
                              │  Web UI   │  │  Frontend │  │  Frontend │
                              │ (built-in)│  │  App A    │  │  App B    │
                              └───────────┘  └───────────┘  └───────────┘
```

### Frontend Integration

Any frontend project can integrate with MCP Bridge:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **HTTP API** | `POST /api/tools` | Register tools |
| **WebSocket** | `ws://localhost:3000/ws` | Respond to tool calls, subscribe to events |

### Web UI Dual Role

The built-in Web UI has dual capabilities:

| Role | Function | Implementation |
|------|----------|----------------|
| **Management UI** | Register/edit/delete/test tools | HTTP API |
| **Executor** | Respond to tool calls from Claude | WebSocket |

## Project Structure

```
mcp-bridge/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Configuration
│   │
│   ├── core/                 # Core engine
│   │   ├── types.ts          # Core type definitions
│   │   ├── registry.ts       # Tool registry (memory storage)
│   │   ├── executor.ts       # Tool executor
│   │   ├── skillRegistry.ts  # Skill registry
│   │   ├── skillExecutor.ts  # Skill execution engine
│   │   ├── skillMdGenerator.ts # SKILL.md generator
│   │   └── schemas.ts        # Zod validation schemas
│   │
│   ├── transport/            # Transport layer
│   │   ├── sse.ts            # SSE MCP server
│   │   ├── websocket.ts      # WebSocket client manager
│   │   ├── ws-handler.ts     # WebSocket message handler
│   │   └── ws-route.ts       # WebSocket routing
│   │
│   ├── api/                  # HTTP API routes
│   │   ├── tools.ts          # Tools CRUD API
│   │   ├── skills.ts         # Skills CRUD + invoke API
│   │   └── logs.ts           # Log query API
│   │
│   └── web/                  # React Web UI
│       ├── App.tsx           # Main app component
│       ├── main.tsx          # Entry point
│       ├── index.html        # HTML template
│       ├── styles.css        # Global styles
│       ├── components/       # Reusable components
│       ├── pages/            # Page components
│       │   ├── ToolListPage.tsx
│       │   ├── SkillEditorPage.tsx
│       │   └── LogsPage.tsx
│       └── services/
│           └── api.ts        # API client
│
├── sdk/                      # Frontend SDK
│   ├── src/
│   │   ├── index.ts          # SDK entry
│   │   ├── client.ts         # MCPBridgeClient class
│   │   └── types.ts          # Type definitions
│   ├── simple.html           # Lightweight tool registration page ✅
│   ├── test-sdk.html         # SDK test page
│   ├── test.html             # Feature test page
│   └── package.json
│
├── .mcp/
│   └── settings.json         # MCP service config
│
├── docs/                     # Documentation
│   ├── phase1-design.md      # Phase 1 technical design
│   └── skill-usage-guide.md  # Skill usage guide
│
├── package.json
├── tsconfig.json
├── vite.config.ts            # Vite config
└── README.md
```

## API Design

### Skills API

```http
# List all Skills
GET /api/skills

# Get single Skill
GET /api/skills/:name

# Create Skill
POST /api/skills
Content-Type: application/json
{
  "name": "weather_recommend",
  "displayName": "Weather Activity Recommendation",
  "description": "Recommend suitable activities based on weather",
  "triggerPhrases": ["recommend activity", "what to do weekend"],
  "exposeModes": {
    "asSkill": true,
    "asTool": true,
    "asPrompt": true
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "City name" }
    },
    "required": ["city"]
  },
  "nodes": [
    { "id": "start", "type": "start", "name": "Start" },
    { "id": "n1", "type": "tool", "name": "Query Weather", "config": { "toolName": "weather_query" } }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "n1" }
  ]
}

# Update Skill
PUT /api/skills/:name

# Delete Skill
DELETE /api/skills/:name

# Invoke Skill
POST /api/skills/:name/invoke
Content-Type: application/json
{
  "city": "Beijing"
}

# Download SKILL.md
GET /api/skills/:name/skill-md

# Download Prompt Template
GET /api/skills/:name/prompt-template
```

### Tools API

```http
# List all tools
GET /api/tools

# Get single tool
GET /api/tools/:name

# Register tool
POST /api/tools
Content-Type: application/json
{
  "name": "get_weather",
  "description": "Get weather information for a city",
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "City name" }
    },
    "required": ["city"]
  },
  "handler": {
    "type": "websocket",
    "timeout": 30000
  }
}

# Update tool
PUT /api/tools/:name

# Delete tool
DELETE /api/tools/:name

# Test tool
POST /api/tools/:name/invoke
Content-Type: application/json
{
  "city": "Beijing"
}
```

### Resources API

```http
# List all resources
GET /api/resources

# Get single resource
GET /api/resources/:uri

# Register resource
POST /api/resources
{
  "uri": "config://app",
  "name": "App Config",
  "description": "Global app configuration",
  "mimeType": "application/json",
  "handler": {
    "type": "static",
    "data": { "version": "1.0.0" }
  }
}

# Delete resource
DELETE /api/resources/:uri
```

### Prompts API

```http
# List all prompts
GET /api/prompts

# Get single prompt
GET /api/prompts/:name

# Register prompt
POST /api/prompts
{
  "name": "code_review",
  "description": "Code review prompt",
  "arguments": [
    { "name": "language", "description": "Programming language", "required": true }
  ],
  "template": "Please review the following {{language}} code:\n\n{{code}}"
}

# Delete prompt
DELETE /api/prompts/:name
```

## WebSocket Protocol

WebSocket enables bidirectional communication between frontends and MCP Bridge, supporting client registration, tool execution requests/responses, and event subscriptions.

### Connection Endpoint

```
ws://localhost:3000/ws
```

### Message Format

All messages are JSON format and must include a `type` field.

---

### Client → Server Messages

#### 1. Register (required, send first after connection)

```javascript
{
  "type": "register",
  "clientId": "my-app-001",           // Optional, auto-generated if omitted
  "capabilities": ["get_weather", "confirm_action"]  // Tools this client can execute
}
```

#### 2. Heartbeat

```javascript
{
  "type": "ping"
}
```

#### 3. Subscribe to Events

```javascript
{
  "type": "subscribe",
  "events": ["tool_invoked", "tool_registered", "tool_deleted"]
}
```

| Event | Description |
|-------|-------------|
| `tool_invoked` | Triggered when a tool is called |
| `tool_registered` | Triggered when a new tool is registered |
| `tool_deleted` | Triggered when a tool is deleted |
| `resource_read` | Triggered when a resource is read |
| `prompt_used` | Triggered when a prompt is used |

#### 4. Tool Execution Response

After receiving `tool_request`, frontend executes and returns result:

```javascript
{
  "type": "tool_response",
  "requestId": "uuid-xxx",            // Must match requestId from tool_request
  "success": true,
  "result": {                         // Result on success
    "temperature": 25,
    "city": "Beijing"
  }
}
```

On failure:

```javascript
{
  "type": "tool_response",
  "requestId": "uuid-xxx",
  "success": false,
  "error": {
    "code": "EXECUTION_FAILED",
    "message": "Unable to fetch weather data"
  }
}
```

#### 5. Unsubscribe

```javascript
{
  "type": "unsubscribe",
  "events": ["tool_invoked"]
}
```

---

### Server → Client Messages

#### 1. Registration Confirmation

```javascript
{
  "type": "registered",
  "clientId": "my-app-001",
  "timestamp": "2024-03-25T10:00:00Z"
}
```

#### 2. Heartbeat Response

```javascript
{
  "type": "pong",
  "timestamp": "2024-03-25T10:00:00Z"
}
```

#### 3. Tool Execution Request

When MCP Client calls a websocket handler tool, server sends execution request to frontend:

```javascript
{
  "type": "tool_request",
  "requestId": "uuid-xxx",            // Unique request ID for matching response
  "tool": "get_weather",
  "action": "getUserConfirmation",    // Optional, frontend-recognized action type
  "arguments": {
    "city": "Beijing"
  },
  "timeout": 30000,                   // Timeout in milliseconds
  "timestamp": "2024-03-25T10:00:00Z"
}
```

#### 4. Event Notification

Pushed when subscribed events occur:

```javascript
{
  "type": "tool_invoked",
  "timestamp": "2024-03-25T10:00:00Z",
  "data": {
    "tool": "get_weather",
    "arguments": { "city": "Beijing" },
    "result": { "temperature": 25 },
    "clientType": "claude-desktop"
  }
}
```

#### 5. Error Notification

```javascript
{
  "type": "error",
  "code": "INVALID_MESSAGE",
  "message": "Message must include 'type' field"
}
```

---

### Error Codes

| Error Code | Description |
|------------|-------------|
| `INVALID_MESSAGE` | Invalid message format |
| `UNKNOWN_MESSAGE_TYPE` | Unknown message type |
| `NOT_REGISTERED` | Client not registered |
| `CLIENT_OFFLINE` | Target client offline |
| `TIMEOUT` | Execution timeout |
| `EXECUTION_FAILED` | Execution failed |
| `REJECTED` | Frontend rejected execution |
| `UNKNOWN_TOOL` | Unknown tool |

---

### Connection Lifecycle

```
┌─────────┐                                          ┌─────────┐
│ Frontend │                                          │ Server  │
└────┬────┘                                          └────┬────┘
     │                                                    │
     │  ── register { capabilities: [...] } ──────────────▶│
     │                                                    │
     │  ◀─────────── registered { clientId } ─────────────│
     │                                                    │
     │  ── subscribe { events: [...] } ──────────────────▶│
     │                                                    │
     │  ◀───────────── subscribed ────────────────────────│
     │                                                    │
     │  ◀──── tool_request { requestId, tool } ──────────│  (Claude calls)
     │                                                    │
     │  ── tool_response { requestId, result } ──────────▶│
     │                                                    │
     │  ◀──── tool_response_sent ────────────────────────│  (Confirm forwarded)
     │                                                    │
     │  ◀────── event: tool_invoked ─────────────────────│  (Subscribed event)
     │                                                    │
     │  ── ping ─────────────────────────────────────────▶│
     │                                                    │
     │  ◀──────────── pong ──────────────────────────────│
     │                                                    │
```

---

### WebSocket Handler Configuration

When registering a tool with websocket handler:

```typescript
{
  "name": "confirm_action",
  "description": "Request user confirmation",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": { "type": "string", "description": "Confirmation message" }
    },
    "required": ["message"]
  },
  "handler": {
    "type": "websocket",
    "action": "getUserConfirmation",  // Frontend-recognized action
    "timeout": 30000,                 // Timeout in ms, default 30000
    "target": "all"                   // Strategy: all | first | specific
  }
}
```

| Field | Description |
|-------|-------------|
| `action` | Action type recognized by frontend to determine how to handle |
| `timeout` | Timeout duration, returns error to MCP Client on timeout |
| `target` | `all` - notify all capable clients; `first` - notify first responding client; `specific` - requires `clientId` |

---

### Frontend Integration Example

Any frontend project can integrate with MCP Bridge for tool registration and call handling.

#### Complete Flow

```typescript
// 1. Register tool via HTTP API
await fetch('http://localhost:3000/api/tools', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'my_custom_tool',
    description: 'My custom tool',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' }
      },
      required: ['input']
    },
    handler: {
      type: 'websocket',  // Specify frontend execution
      action: 'handleCustomTool',
      timeout: 30000
    }
  })
})

// 2. Establish WebSocket connection
const ws = new WebSocket('ws://localhost:3000/ws')

ws.onopen = () => {
  // Register client capabilities (declare which tools it can execute)
  ws.send(JSON.stringify({
    type: 'register',
    clientId: 'my-frontend-app',
    capabilities: ['my_custom_tool']
  }))
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)

  // Handle tool execution request
  if (message.type === 'tool_request') {
    const { requestId, tool, action, arguments } = message

    if (action === 'handleCustomTool') {
      // Execute your business logic
      const result = await doSomething(arguments.input)

      // Return result
      ws.send(JSON.stringify({
        type: 'tool_response',
        requestId,
        success: true,
        result
      }))
    }
  }
}
```

#### Use Cases

| Scenario | Description |
|----------|-------------|
| User Confirmation | Claude requests user confirmation, frontend shows dialog |
| Data Query | Claude needs data from frontend application |
| Execute Action | Claude triggers frontend action (e.g., send message) |
| Human Intervention | Scenarios requiring human review/input |

---

### Frontend SDK Usage

JavaScript/TypeScript SDK for simplified integration:

```typescript
import { MCPBridgeClient } from 'mcp-bridge-sdk'

const client = new MCPBridgeClient('ws://localhost:3000/ws')

// Connect and register
await client.connect({
  clientId: 'my-app',
  capabilities: ['get_weather', 'confirm_action']
})

// Listen for tool execution requests
client.on('tool_request', async (request) => {
  const { requestId, tool, action, arguments } = request

  if (action === 'getUserConfirmation') {
    const confirmed = await showConfirmDialog(arguments.message)
    client.respond(requestId, confirmed, confirmed ? undefined : { code: 'REJECTED' })
  }

  if (tool === 'get_weather') {
    const weather = await fetchWeather(arguments.city)
    client.respond(requestId, weather)
  }
})

// Subscribe to events
client.subscribe(['tool_invoked', 'tool_registered'])

client.on('tool_invoked', (event) => {
  console.log('Tool invoked:', event.data)
})

// Disconnect
client.disconnect()
```

## Implementation Status

### ✅ Completed

| Feature | Status | Description |
|---------|--------|-------------|
| **Tools Core Module** | ✅ Done | Registry + Executor (memory storage) |
| **Skill Orchestration Engine** | ✅ Done | Visual orchestration, conditional branching, multi-tool composition |
| **Skill Documentation Generation** | ✅ Done | Auto-generate SKILL.md and Prompt templates |
| **HTTP API (Tools)** | ✅ Done | CRUD + invoke test endpoint |
| **HTTP API (Skills)** | ✅ Done | CRUD + invoke + documentation download |
| **SSE Transport** | ✅ Done | MCP Client connection via SSE |
| **WebSocket Service** | ✅ Done | Bidirectional communication, heartbeat, event subscription |
| **WebSocket Handler** | ✅ Done | Tool execution request/response flow |
| **Frontend SDK** | ✅ Done | `mcp-bridge-sdk` with registration, listening, response |
| **Simple Page** | ✅ Done | Lightweight tool registration page with heartbeat |
| **MCP Config Generation** | ✅ Done | Auto-generate `.mcp/settings.json` |

### 🚧 In Progress

| Feature | Status | Description |
|---------|--------|-------------|
| **static/http handler** | 🚧 Partial | Framework ready, implementation pending |

### ❌ Not Started

| Feature | Status | Description |
|---------|--------|-------------|
| **stdio Transport** | ❌ Pending | Local process communication |
| **Resources Module** | ❌ Pending | Resource registration and reading |
| **Prompts Module** | ❌ Pending | Prompt template management |
| **React Web UI** | ✅ Done | Full management interface (Skill orchestration, tool management, logs) |
| **Persistent Storage** | ❌ Pending | SQLite/Redis support |
| **Unit Tests** | ✅ Done | Core module test coverage |
| **Docker Config** | ❌ Pending | Dockerfile + docker-compose |
| **Script Handler** | ❌ Pending | Sandbox script execution |

---

## Implementation Roadmap (Vertical Slices)

### Phase 1: Tools Module (MVP) ✅ Completed
1. ✅ Core Registry and Executor (memory storage)
2. ✅ HTTP API (CRUD + invoke)
3. ✅ MCP Server (SSE)
4. ✅ WebSocket protocol implementation
   - ✅ Client registration/heartbeat
   - ✅ Tool execution request/response
   - ✅ Event subscription
5. ✅ Frontend SDK + example pages
   - ✅ `sdk/simple.html` - lightweight registration page
   - ✅ `sdk/test-sdk.html` - SDK test page
   - ✅ `mcp-bridge-sdk` - NPM package

### Phase 2: Skill Orchestration Engine ✅ Completed
1. ✅ Skill core type definitions
2. ✅ Skill execution engine (tool invocation, conditional branching)
3. ✅ Skill registry
4. ✅ Visual orchestration UI
5. ✅ Documentation generation
   - ✅ SKILL.md auto-generation
   - ✅ Prompt template generation
6. ✅ HTTP API (Skills CRUD + invoke + doc download)

### Phase 3: Feature Enhancement
1. 🚧 static / http handler support
2. ❌ Resources module
3. ❌ Prompts module

### Phase 3: Persistence & Optimization
1. ❌ Storage layer upgrade (SQLite/Redis)
2. ✅ Unit tests
3. ❌ Performance optimization
4. ✅ Documentation improvement

## Handler Types

Tools support multiple handler types:

| Type | Description | Use Case |
|------|-------------|----------|
| `static` | Return static data | Mock data, fixed config |
| `http` | Call external HTTP API | Third-party service integration |
| `websocket` | Call frontend via WebSocket | Operations requiring frontend |
| `skill` | Call existing Skill | Reuse existing Skill capabilities |
| `script` | Execute script (sandbox) | Custom logic |

```typescript
// HTTP Handler example
{
  "type": "http",
  "url": "https://api.example.com/endpoint",
  "method": "POST",
  "headers": { "Authorization": "Bearer xxx" },
  "bodyMapping": "$.arguments"  // JSONPath mapping
}

// WebSocket Handler example
{
  "type": "websocket",
  "timeout": 30000,
  "responsePath": "$.result"  // Extract result from response
}

// Script Handler example
{
  "type": "script",
  "runtime": "javascript",
  "code": "return arguments.city.toUpperCase();"
}
```

## Docker Deployment

> **Note**: Docker configuration is not yet implemented, planned for future versions.

```bash
# Build image (pending)
docker build -t mcp-bridge:latest .

# Run container (pending)
docker run -d \
  -p 3000:3000 \
  -e MCP_BRIDGE_PORT=3000 \
  --name mcp-bridge \
  mcp-bridge:latest
```

> **Note**: Currently using memory storage, data will be lost on container restart.

## Configuration

```typescript
// src/config.ts
export const config = {
  // Server port
  port: parseInt(process.env.MCP_BRIDGE_PORT || '3000', 10),

  // Server URL (for MCP config generation)
  serverUrl: process.env.MCP_BRIDGE_URL || 'http://localhost:3000',

  // MCP server config
  mcp: {
    name: process.env.MCP_NAME || 'mcp-bridge',
    version: '1.0.0',
  },

  // WebSocket config
  websocket: {
    path: '/ws',
    heartbeat: 30000,  // Heartbeat interval (ms)
  },
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_BRIDGE_PORT` | `3000` | Server port |
| `MCP_BRIDGE_URL` | `http://localhost:3000` | Server URL |
| `MCP_NAME` | `mcp-bridge` | MCP service name |

> **Note**: Currently using memory storage, data will be lost on server restart. Future versions will support persistent storage.

## Usage Examples

### Start Server

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build

# Start production server
npm start
```

### Connect via SSE (Recommended)

MCP Bridge currently supports SSE protocol, connectable by Claude Code or other MCP clients:

```json
// .mcp/settings.json
{
  "mcpServers": {
    "mcp-bridge": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

### MCP Client Code Example

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

const transport = new SSEClientTransport(
  new URL('http://localhost:3000/sse')
)
const client = new Client({ name: 'my-client', version: '1.0.0' }, {})
await client.connect(transport)
```

### Quick Tool Test

```bash
# List registered tools
curl http://localhost:3000/api/tools

# Call a tool
curl -X POST http://localhost:3000/api/tools/say_good/invoke \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
```

## License

MIT