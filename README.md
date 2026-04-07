# MCP Bridge

一个动态 MCP (Model Context Protocol) 服务桥接器，支持通过 Web UI 或 API 动态注册 MCP 能力，支持 SSE 协议，并实现 MCP Client 与前端之间的双向通信。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
npm run dev

# 3. 打开 http://localhost:3000/sdk/simple.html 注册工具

# 4. 在 .mcp/settings.json 中配置连接
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

## 核心功能

### 1. 动态注册 MCP 能力
- **Tools**: 动态注册可被 MCP Client 调用的工具函数 ✅
- **Skills**: 可视化编排复杂工作流，支持条件分支、多工具组合 ✅
- **Resources**: 动态注册可被读取的资源（规划中）
- **Prompts**: 动态注册预定义的提示词模板（规划中）

### 2. 协议支持
- **SSE (HTTP)**: 远程/Web 访问，适配 Claude Code 等网络客户端 ✅
- **stdio**: 本地进程通信（规划中）

### 3. 双向通信
- Web UI 通过 HTTP API 注册工具
- MCP Client (Claude) 调用工具时，MCP Bridge 通过 WebSocket 通知 Web UI 执行
- Web UI 执行完毕后返回结果，MCP Bridge 再返回给 Claude

### 4. 核心调用流程

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Web UI  │      │   MCP    │      │   MCP    │      │  Claude  │
│          │      │  Bridge  │      │  Server  │      │ Desktop │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │
     │  1. 注册工具     │                 │                 │
     │ ───────────────▶│                 │                 │
     │                 │                 │                 │
     │                 │                 │   2. 调用工具    │
     │                 │                 │ ◀───────────────│
     │                 │                 │                 │
     │                 │  3. 转发请求     │                 │
     │                 │ ◀───────────────│                 │
     │                 │                 │                 │
     │  4. tool_request│                 │                 │
     │ ◀───────────────│                 │                 │
     │                 │                 │                 │
     │  5. 执行操作     │                 │                 │
     │  (用户交互/业务) │                 │                 │
     │                 │                 │                 │
     │  6. tool_response│                │                 │
     │ ───────────────▶│                 │                 │
     │                 │                 │                 │
     │                 │  7. 返回结果     │                 │
     │                 │ ───────────────▶│                 │
     │                 │                 │                 │
     │                 │                 │  8. 返回给 Claude│
     │                 │                 │ ───────────────▶│
     │                 │                 │                 │
```

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 运行时 | Node.js 20+ (ESM) |
| 后端框架 | Hono |
| MCP SDK | @modelcontextprotocol/sdk |
| WebSocket | Hono 内置 |
| 存储 | 内存缓存（Map），后续可升级为 SQLite/Redis |
| 前端 | React 18 + Vite + TypeScript |
| 容器化 | Docker multi-stage build |

## 架构设计

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
│ (Claude等)    │                         │   连接端点      │
└───────────────┘                         └────────┬────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    │              │              │
                              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
                              │  Web UI   │  │  前端应用A │  │  前端应用B │
                              │ (内置)    │  │ (任意项目) │  │ (任意项目) │
                              └───────────┘  └───────────┘  └───────────┘
```

### 前端项目接入方式

任意前端项目都可以通过以下方式接入 MCP Bridge：

| 接入方式 | 说明 | 用途 |
|----------|------|------|
| **HTTP API** | `POST /api/tools` | 注册工具 |
| **WebSocket** | `ws://localhost:3000/ws` | 响应工具调用、订阅事件 |

### Web UI 特殊角色

Web UI 是 MCP Bridge 内置的前端项目，具备双重能力：

| 角色 | 功能 | 实现方式 |
|------|------|----------|
| **管理界面** | 注册/编辑/删除/测试工具 | HTTP API |
| **执行端** | 响应 Claude 的工具调用请求 | WebSocket |

## 项目结构

```
mcp-bridge/
├── src/
│   ├── index.ts              # 入口文件
│   ├── config.ts             # 配置管理
│   │
│   ├── core/                 # 核心引擎
│   │   ├── types.ts          # 核心类型定义
│   │   ├── registry.ts       # 工具注册中心（内存存储）
│   │   ├── executor.ts       # 工具执行器
│   │   ├── skillRegistry.ts  # Skill 注册中心
│   │   ├── skillExecutor.ts  # Skill 执行引擎
│   │   ├── skillMdGenerator.ts # SKILL.md 生成器
│   │   └── schemas.ts        # Zod 验证模式
│   │
│   ├── transport/            # 传输层
│   │   ├── sse.ts            # SSE MCP 服务器
│   │   ├── websocket.ts      # WebSocket 客户端管理
│   │   ├── ws-handler.ts     # WebSocket 消息处理
│   │   └── ws-route.ts       # WebSocket 路由
│   │
│   ├── api/                  # HTTP API 路由
│   │   ├── tools.ts          # Tools CRUD API
│   │   ├── skills.ts         # Skills CRUD + invoke API
│   │   └── logs.ts           # 日志查询 API
│   │
│   └── web/                  # React Web UI
│       ├── App.tsx           # 主应用组件
│       ├── main.tsx          # 入口
│       ├── index.html        # HTML 模板
│       ├── styles.css        # 全局样式
│       ├── components/       # 可复用组件
│       ├── pages/            # 页面组件
│       │   ├── ToolListPage.tsx
│       │   ├── SkillEditorPage.tsx
│       │   └── LogsPage.tsx
│       └── services/
│           └── api.ts        # API 客户端
│
├── sdk/                      # 前端 SDK
│   ├── src/
│   │   ├── index.ts          # SDK 入口
│   │   ├── client.ts         # MCPBridgeClient 类
│   │   └── types.ts          # 类型定义
│   ├── simple.html           # 轻量级工具注册页面 ✅
│   ├── test-sdk.html         # SDK 测试页面
│   ├── test.html             # 功能测试页面
│   └── package.json
│
├── .mcp/
│   └── settings.json         # MCP 服务配置
│
├── docs/                     # 文档
│   ├── phase1-design.md      # 第一阶段技术方案
│   └── skill-usage-guide.md  # Skill 使用指南
│
├── package.json
├── tsconfig.json
├── vite.config.ts            # Vite 配置
└── README.md
```

## API 设计

### Skills API

```http
# 列出所有 Skills
GET /api/skills

# 获取单个 Skill
GET /api/skills/:name

# 创建 Skill
POST /api/skills
Content-Type: application/json
{
  "name": "weather_recommend",
  "displayName": "天气活动推荐",
  "description": "根据天气情况推荐合适的活动",
  "triggerPhrases": ["推荐活动", "周末干什么"],
  "exposeModes": {
    "asSkill": true,
    "asTool": true,
    "asPrompt": true
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "城市名称" }
    },
    "required": ["city"]
  },
  "nodes": [
    { "id": "start", "type": "start", "name": "开始" },
    { "id": "n1", "type": "tool", "name": "查询天气", "config": { "toolName": "weather_query" } }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "n1" }
  ]
}

# 更新 Skill
PUT /api/skills/:name

# 删除 Skill
DELETE /api/skills/:name

# 调用 Skill
POST /api/skills/:name/invoke
Content-Type: application/json
{
  "city": "北京"
}

# 下载 SKILL.md
GET /api/skills/:name/skill-md

# 下载 Prompt 模板
GET /api/skills/:name/prompt-template
```

### Tools API

```http
# 列出所有工具
GET /api/tools

# 获取单个工具
GET /api/tools/:name

# 注册工具
POST /api/tools
Content-Type: application/json
{
  "name": "get_weather",
  "description": "获取指定城市的天气信息",
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "城市名称" }
    },
    "required": ["city"]
  },
  "handler": {
    "type": "http",
    "url": "https://api.weather.com/current",
    "method": "GET"
  }
}

# 更新工具
PUT /api/tools/:name

# 删除工具
DELETE /api/tools/:name

# 测试工具
POST /api/tools/:name/invoke
Content-Type: application/json
{
  "city": "北京"
}
```

### Resources API

```http
# 列出所有资源
GET /api/resources

# 获取单个资源
GET /api/resources/:uri

# 注册资源
POST /api/resources
{
  "uri": "config://app",
  "name": "应用配置",
  "description": "全局应用配置",
  "mimeType": "application/json",
  "handler": {
    "type": "static",
    "data": { "version": "1.0.0" }
  }
}

# 删除资源
DELETE /api/resources/:uri
```

### Prompts API

```http
# 列出所有提示词
GET /api/prompts

# 获取单个提示词
GET /api/prompts/:name

# 注册提示词
POST /api/prompts
{
  "name": "code_review",
  "description": "代码审查提示词",
  "arguments": [
    { "name": "language", "description": "编程语言", "required": true }
  ],
  "template": "请审查以下 {{language}} 代码：\n\n{{code}}"
}

# 删除提示词
DELETE /api/prompts/:name
```

## WebSocket 协议设计

WebSocket 用于前端与 MCP Bridge 之间的双向通信，支持客户端注册、工具执行请求/响应、事件订阅等功能。

### 连接端点

```
ws://localhost:3000/ws
```

### 消息格式

所有消息均为 JSON 格式，必须包含 `type` 字段。

---

### 客户端 → 服务端消息

#### 1. 注册（必需，连接后首先发送）

```javascript
{
  "type": "register",
  "clientId": "my-app-001",           // 可选，不填则自动生成
  "capabilities": ["get_weather", "confirm_action"]  // 可执行的工具列表
}
```

#### 2. 心跳

```javascript
{
  "type": "ping"
}
```

#### 3. 订阅事件

```javascript
{
  "type": "subscribe",
  "events": ["tool_invoked", "tool_registered", "tool_deleted"]
}
```

| 事件 | 说明 |
|------|------|
| `tool_invoked` | 工具被调用时触发 |
| `tool_registered` | 新工具注册时触发 |
| `tool_deleted` | 工具删除时触发 |
| `resource_read` | 资源被读取时触发 |
| `prompt_used` | 提示词被使用时触发 |

#### 4. 工具执行响应

当收到 `tool_request` 后，前端执行完毕返回结果：

```javascript
{
  "type": "tool_response",
  "requestId": "uuid-xxx",            // 必须与 tool_request 中的 requestId 一致
  "success": true,
  "result": {                         // 成功时返回
    "temperature": 25,
    "city": "北京"
  }
}
```

执行失败时：

```javascript
{
  "type": "tool_response",
  "requestId": "uuid-xxx",
  "success": false,
  "error": {
    "code": "EXECUTION_FAILED",
    "message": "无法获取天气信息"
  }
}
```

#### 5. 取消订阅

```javascript
{
  "type": "unsubscribe",
  "events": ["tool_invoked"]
}
```

---

### 服务端 → 客户端消息

#### 1. 注册确认

```javascript
{
  "type": "registered",
  "clientId": "my-app-001",
  "timestamp": "2024-03-25T10:00:00Z"
}
```

#### 2. 心跳响应

```javascript
{
  "type": "pong",
  "timestamp": "2024-03-25T10:00:00Z"
}
```

#### 3. 工具执行请求

MCP Client 调用 websocket handler 类型的工具时，服务端向前端发送执行请求：

```javascript
{
  "type": "tool_request",
  "requestId": "uuid-xxx",            // 请求唯一标识，用于匹配响应
  "tool": "get_weather",
  "action": "getUserConfirmation",    // 可选，前端识别的操作类型
  "arguments": {
    "city": "北京"
  },
  "timeout": 30000,                   // 超时时间（毫秒）
  "timestamp": "2024-03-25T10:00:00Z"
}
```

#### 4. 事件通知

订阅的事件发生时推送：

```javascript
{
  "type": "tool_invoked",
  "timestamp": "2024-03-25T10:00:00Z",
  "data": {
    "tool": "get_weather",
    "arguments": { "city": "北京" },
    "result": { "temperature": 25 },
    "clientType": "claude-desktop"
  }
}
```

#### 5. 错误通知

```javascript
{
  "type": "error",
  "code": "INVALID_MESSAGE",
  "message": "Message must include 'type' field"
}
```

---

### 错误码定义

| 错误码 | 说明 |
|--------|------|
| `INVALID_MESSAGE` | 消息格式错误 |
| `UNKNOWN_MESSAGE_TYPE` | 未知的消息类型 |
| `NOT_REGISTERED` | 客户端未注册 |
| `CLIENT_OFFLINE` | 目标客户端离线 |
| `TIMEOUT` | 执行超时 |
| `EXECUTION_FAILED` | 执行失败 |
| `REJECTED` | 前端拒绝执行 |
| `UNKNOWN_TOOL` | 未知的工具 |

---

### 连接生命周期

```
┌─────────┐                                          ┌─────────┐
│  前端    │                                          │ Server  │
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
     │  ◀──── tool_request { requestId, tool } ──────────│  (Claude 调用)
     │                                                    │
     │  ── tool_response { requestId, result } ──────────▶│
     │                                                    │
     │  ◀──── tool_response_sent ────────────────────────│  (确认已转发给 Claude)
     │                                                    │
     │  ◀────── event: tool_invoked ─────────────────────│  (订阅的事件)
     │                                                    │
     │  ── ping ─────────────────────────────────────────▶│
     │                                                    │
     │  ◀──────────── pong ──────────────────────────────│
     │                                                    │
```

---

### WebSocket Handler 配置

注册工具时，websocket handler 配置：

```typescript
{
  "name": "confirm_action",
  "description": "请求用户确认操作",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": { "type": "string", "description": "确认消息" }
    },
    "required": ["message"]
  },
  "handler": {
    "type": "websocket",
    "action": "getUserConfirmation",  // 前端识别的 action
    "timeout": 30000,                 // 超时时间（毫秒），默认 30000
    "target": "all"                   // 通知策略：all | first | specific
  }
}
```

| 字段 | 说明 |
|------|------|
| `action` | 前端识别的操作类型，前端根据此字段决定如何处理 |
| `timeout` | 超时时间，超时后返回错误给 MCP Client |
| `target` | `all` - 通知所有能执行该工具的客户端；`first` - 通知第一个响应的客户端；`specific` - 需配合 `clientId` 使用 |

---

### 任意前端项目接入示例

任何前端项目都可以接入 MCP Bridge，实现工具注册和响应调用。

#### 完整流程

```typescript
// 1. 通过 HTTP API 注册工具
await fetch('http://localhost:3000/api/tools', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'my_custom_tool',
    description: '我的自定义工具',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' }
      },
      required: ['input']
    },
    handler: {
      type: 'websocket',  // 指定由前端执行
      action: 'handleCustomTool',
      timeout: 30000
    }
  })
})

// 2. 建立 WebSocket 连接
const ws = new WebSocket('ws://localhost:3000/ws')

ws.onopen = () => {
  // 注册客户端能力（声明能执行哪些工具）
  ws.send(JSON.stringify({
    type: 'register',
    clientId: 'my-frontend-app',
    capabilities: ['my_custom_tool']
  }))
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)

  // 处理工具执行请求
  if (message.type === 'tool_request') {
    const { requestId, tool, action, arguments } = message

    if (action === 'handleCustomTool') {
      // 执行你的业务逻辑
      const result = await doSomething(arguments.input)

      // 返回结果
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

#### 使用场景

| 场景 | 说明 |
|------|------|
| 用户确认 | Claude 请求用户确认操作，前端弹出确认框 |
| 数据查询 | Claude 需要前端应用的数据 |
| 执行操作 | Claude 触发前端执行某个操作（如发送消息） |
| 人工介入 | 需要人工审核/输入的场景 |

---

### 前端 SDK 使用示例

为简化接入，提供 JavaScript/TypeScript SDK：

```typescript
import { MCPBridgeClient } from 'mcp-bridge-sdk'

const client = new MCPBridgeClient('ws://localhost:3000/ws')

// 连接并注册
await client.connect({
  clientId: 'my-app',
  capabilities: ['get_weather', 'confirm_action']
})

// 监听工具执行请求
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

// 订阅事件
client.subscribe(['tool_invoked', 'tool_registered'])

client.on('tool_invoked', (event) => {
  console.log('Tool invoked:', event.data)
})

// 断开连接
client.disconnect()
```

## 实现状态

### ✅ 已完成

| 功能 | 状态 | 说明 |
|------|------|------|
| **Tools 核心模块** | ✅ 完成 | Registry + Executor（内存存储） |
| **Skill 编排引擎** | ✅ 完成 | 可视化编排、条件分支、多工具组合 |
| **Skill 文档生成** | ✅ 完成 | 自动生成 SKILL.md 和 Prompt 模板 |
| **HTTP API (Tools)** | ✅ 完成 | CRUD + invoke 测试接口 |
| **HTTP API (Skills)** | ✅ 完成 | CRUD + invoke + 文档下载 |
| **SSE Transport** | ✅ 完成 | 支持 MCP Client 通过 SSE 连接 |
| **WebSocket 服务** | ✅ 完成 | 双向通信、心跳检测、事件订阅 |
| **WebSocket Handler** | ✅ 完成 | 工具执行请求/响应流程 |
| **前端 SDK** | ✅ 完成 | `mcp-bridge-sdk`，支持注册、监听、响应 |
| **Simple 页面** | ✅ 完成 | 轻量级工具注册页面，支持心跳保活 |
| **MCP 配置生成** | ✅ 完成 | 自动生成 `.mcp/settings.json` |

### 🚧 进行中

| 功能 | 状态 | 说明 |
|------|------|------|
| **static/http handler** | 🚧 部分 | 框架已预留，具体实现待完善 |

### ❌ 未完成

| 功能 | 状态 | 说明 |
|------|------|------|
| **stdio Transport** | ❌ 未开始 | 本地进程通信模式 |
| **Resources 模块** | ❌ 未开始 | 资源注册与读取 |
| **Prompts 模块** | ❌ 未开始 | 提示词模板管理 |
| **React Web UI** | ✅ 已完成 | 完整管理界面（Skill 编排、工具管理、日志查看） |
| **持久化存储** | ❌ 未开始 | SQLite/Redis 支持 |
| **单元测试** | ✅ 已完成 | 核心模块测试覆盖 |
| **Docker 配置** | ❌ 未开始 | Dockerfile + docker-compose |
| **Script Handler** | ❌ 未开始 | 沙箱脚本执行 |

---

## 实现计划（垂直切片）

### 第一阶段：Tools 模块（MVP）✅ 已完成
1. ✅ 核心 Registry 和 Executor（内存存储）
2. ✅ HTTP API (CRUD + invoke)
3. ✅ MCP Server (SSE)
4. ✅ WebSocket 协议实现
   - ✅ 客户端注册/心跳
   - ✅ 工具执行请求/响应
   - ✅ 事件订阅
5. ✅ 前端 SDK + 示例页面
   - ✅ `sdk/simple.html` - 轻量级注册页面
   - ✅ `sdk/test-sdk.html` - SDK 测试页面
   - ✅ `mcp-bridge-sdk` - NPM 包

### 第二阶段：Skill 编排引擎 ✅ 已完成
1. ✅ Skill 核心类型定义
2. ✅ Skill 执行引擎（支持工具调用、条件分支）
3. ✅ Skill 注册中心
4. ✅ 可视化编排 UI
5. ✅ 文档生成功能
   - ✅ SKILL.md 自动生成
   - ✅ Prompt 模板生成
6. ✅ HTTP API (Skills CRUD + invoke + 文档下载)

### 第三阶段：完善功能
1. 🚧 static / http handler 支持
2. ❌ Resources 模块
3. ❌ Prompts 模块

### 第三阶段：持久化与优化
1. ❌ 存储层升级（SQLite/Redis）
2. ✅ 单元测试
3. ❌ 性能优化
4. ✅ 文档完善

## Handler 类型

工具执行支持多种处理器类型：

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| `static` | 返回静态数据 | Mock 数据、固定配置 |
| `http` | 调用外部 HTTP API | 集成第三方服务 |
| `websocket` | 通过 WebSocket 调用前端 | 需要前端参与的操作 |
| `skill` | 调用已定义的 Skill | 复用已有 Skill 能力 |
| `script` | 执行脚本（沙箱） | 自定义逻辑 |

```typescript
// HTTP Handler 示例
{
  "type": "http",
  "url": "https://api.example.com/endpoint",
  "method": "POST",
  "headers": { "Authorization": "Bearer xxx" },
  "bodyMapping": "$.arguments"  // JSONPath 映射
}

// WebSocket Handler 示例
{
  "type": "websocket",
  "timeout": 30000,
  "responsePath": "$.result"  // 从响应中提取结果
}

// Script Handler 示例
{
  "type": "script",
  "runtime": "javascript",
  "code": "return arguments.city.toUpperCase();"
}
```

## Docker 部署

> **注意**：Docker 配置尚未实现，计划在后续版本中添加。

```bash
# 构建镜像（待实现）
docker build -t mcp-bridge:latest .

# 运行容器（待实现）
docker run -d \
  -p 3000:3000 \
  -e MCP_BRIDGE_PORT=3000 \
  --name mcp-bridge \
  mcp-bridge:latest
```

> **注意**：当前使用内存存储，容器重启后数据会丢失。

## 配置说明

```typescript
// src/config.ts
export const config = {
  // 服务端口
  port: parseInt(process.env.MCP_BRIDGE_PORT || '3000', 10),

  // 服务 URL（用于生成 MCP 配置）
  serverUrl: process.env.MCP_BRIDGE_URL || 'http://localhost:3000',

  // MCP 服务器配置
  mcp: {
    name: process.env.MCP_NAME || 'mcp-bridge',
    version: '1.0.0',
  },

  // WebSocket 配置
  websocket: {
    path: '/ws',
    heartbeat: 30000,  // 心跳间隔（毫秒）
  },
}
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MCP_BRIDGE_PORT` | `3000` | 服务端口 |
| `MCP_BRIDGE_URL` | `http://localhost:3000` | 服务 URL |
| `MCP_NAME` | `mcp-bridge` | MCP 服务名称 |

> **注意**：当前使用内存存储，服务重启后数据会丢失。后续版本将支持持久化存储。

## 使用示例

### 启动服务

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 启动生产服务
npm start
```

### 通过 SSE 连接（推荐）

MCP Bridge 目前支持 SSE 协议，可被 Claude Code 或其他 MCP 客户端连接：

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

### MCP Client 代码示例

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

const transport = new SSEClientTransport(
  new URL('http://localhost:3000/sse')
)
const client = new Client({ name: 'my-client', version: '1.0.0' }, {})
await client.connect(transport)
```

### 快速测试工具

```bash
# 列出已注册工具
curl http://localhost:3000/api/tools

# 调用工具
curl -X POST http://localhost:3000/api/tools/say_good/invoke \
  -H "Content-Type: application/json" \
  -d '{"name": "测试"}'
```

## License

MIT