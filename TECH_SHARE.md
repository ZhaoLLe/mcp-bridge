# MCP Bridge 技术分享

> 动态 MCP 服务桥接器 - 让 AI 助手与你的一切应用无缝连接

---

## 目录

1. [项目背景](#项目背景)
2. [核心价值](#核心价值)
3. [项目亮点](#项目亮点)
4. [应用场景](#应用场景)
5. [技术架构](#技术架构)
6. [核心技术细节](#核心技术细节)
7. [快速演示](#快速演示)
8. [未来规划](#未来规划)
9. [Q&A](#qa)

---

## 项目背景

### 什么是 MCP？

**MCP (Model Context Protocol)** 是 Anthropic 推出的开放协议，让 AI 助手（如 Claude）能够与外部工具和数据源交互。

```
传统方式：AI 只能"说话"，无法"做事"
MCP 方式：AI 可以调用工具、读取资源、执行操作
```

### 为什么需要 MCP Bridge？

| 痛点 | 传统 MCP 开发 | MCP Bridge |
|------|--------------|------------|
| 工具定义 | 硬编码在代码中 | 动态注册，无需重启 |
| 开发门槛 | 需要编写服务端代码 | Web UI 或 API 即可配置 |
| 调试困难 | 需要 Claude Desktop 测试 | 内置测试接口 |
| 多应用集成 | 每个应用独立 MCP 服务 | 统一桥接，集中管理 |

---

## 核心价值

### 一句话定位

> **让任何前端应用都能成为 AI 助手的"手和眼"**

### 三大核心能力

```
┌─────────────────────────────────────────────────────────┐
│                     MCP Bridge                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   📦 动态注册        🔄 双向通信         🔌 协议适配    │
│                                                         │
│   • 运行时注册工具    • AI → 前端请求    • SSE 协议     │
│   • 无需重启服务      • 前端 → AI 响应   • WebSocket    │
│   • 即时生效          • 实时事件推送     • HTTP API     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 项目亮点

### 🌟 亮点一：动态工具注册

**传统方式：**
```typescript
// 必须硬编码，修改需要重启服务
server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    { name: 'get_weather', description: '...' }
  ]
}))
```

**MCP Bridge 方式：**
```bash
# 一行命令注册工具
curl -X POST http://localhost:3000/api/tools -d '{
  "name": "my_tool",
  "description": "我的工具",
  "inputSchema": { ... },
  "handler": { "type": "websocket" }
}'
```

**优势：**
- ✅ 无需重启服务
- ✅ 无需编写服务端代码
- ✅ 支持 Web UI 可视化配置

---

### 🌟 亮点二：双向通信机制

**核心创新：让前端应用成为工具执行者**

```
┌─────────────┐                    ┌─────────────┐
│    Claude   │                    │   你的应用   │
│  (AI 大脑)  │                    │  (执行者)   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  "帮我确认这个操作"               │
       │         ┌─────────────┐          │
       │────────▶│ MCP Bridge  │─────────▶│
       │         │   (桥接)    │          │
       │         └─────────────┘          │
       │                                  │
       │                    弹出确认框 ←───│
       │                                  │
       │         用户点击"确认"            │
       │◀─────────────────────────────────│
       │                                  │
       │  "用户已确认，继续执行"           │
       │                                  │
```

**应用场景：**
- 🔐 敏感操作需用户确认
- 📊 需要前端数据/状态
- 🖱️ 需要用户交互的场景

---

### 🌟 亮点三：多协议支持

| 协议 | 用途 | 状态 |
|------|------|------|
| **SSE** | MCP 客户端连接（Claude Code） | ✅ 已实现 |
| **WebSocket** | 前端应用连接 | ✅ 已实现 |
| **HTTP API** | 工具管理、测试 | ✅ 已实现 |

**架构优势：**
```
                    ┌─────────────────┐
                    │   MCP Bridge    │
                    │                 │
    SSE ◄──────────▶│  ┌───────────┐  │◄──────────▶ WebSocket
 (Claude Code)      │  │   Core    │  │           (前端应用)
                    │  │  Engine   │  │
                    │  └───────────┘  │
                    │        │        │
                    └────────┼────────┘
                             │
                        HTTP API
                      (管理/测试)
```

---

### 🌟 亮点四：低门槛集成

**5 分钟快速接入：**

```html
<!-- 你的前端应用 -->
<script>
const ws = new WebSocket('ws://localhost:3000/ws')

ws.onopen = () => {
  // 1. 注册能力
  ws.send(JSON.stringify({
    type: 'register',
    capabilities: ['my_tool']
  }))
}

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  // 2. 响应工具调用
  if (msg.type === 'tool_request') {
    const result = await doSomething(msg.arguments)
    ws.send(JSON.stringify({
      type: 'tool_response',
      requestId: msg.requestId,
      success: true,
      result
    }))
  }
}
</script>
```

---

## 应用场景

### 场景一：智能客服系统

```
用户: "帮我查询订单状态"
Claude: 调用 query_order 工具
    ↓
MCP Bridge: 转发到客服系统前端
    ↓
客服系统: 从数据库查询，返回结果
    ↓
Claude: "您的订单已发货，预计明天送达"
```

### 场景二：安全操作确认

```
用户: "删除所有测试数据"
Claude: 检测到敏感操作，调用 confirm_dangerous_action
    ↓
MCP Bridge: 通知前端
    ↓
前端: 弹出确认框 "确定要删除吗？"
    ↓
用户: 点击"确认"
    ↓
Claude: 执行删除操作
```

### 场景三：多应用协同

```
┌──────────────┐
│  Claude AI   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ MCP Bridge   │
└──────┬───────┘
       │
       ├──▶ 📊 数据看板应用 (查询图表数据)
       │
       ├──▶ 💬 即时通讯应用 (发送消息)
       │
       └──▶ 📝 文档编辑应用 (插入内容)
```

---

## 技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MCP Bridge Server                            │
│                         (Port 3000)                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │   Transport     │  │   Core Engine   │  │    Push Service     │ │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────────┤ │
│  │ • SSE Server    │  │ • Tool Registry │  │ • WebSocket Server   │ │
│  │ • HTTP API      │  │ • Tool Executor │  │ • Event Emitter     │ │
│  │                 │  │ • Schema Valid  │  │ • Subscription Mgr  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘ │
│           │                   │                      │             │
│           └───────────────────┼──────────────────────┘             │
│                               ▼                                    │
│                    ┌─────────────────────┐                         │
│                    │   Memory Storage    │                         │
│                    │    (Map-based)      │                         │
│                    └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
        │                                           │
        ▼                                           ▼
┌───────────────┐                         ┌─────────────────┐
│ MCP Clients   │                         │   WebSocket     │
│ • Claude Code │                         │   Clients       │
│ • Claude Desk │                         │ • Web Apps      │
└───────────────┘                         │ • SDK Clients   │
                                          └─────────────────┘
```

### 技术栈选型

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| **运行时** | Node.js 20+ (ESM) | 原生支持 ES 模块，性能优秀 |
| **Web 框架** | Hono | 轻量、快速、TypeScript 友好 |
| **MCP SDK** | @modelcontextprotocol/sdk | 官方 SDK，协议兼容性保证 |
| **WebSocket** | ws | 高性能、成熟稳定 |
| **验证** | Zod | 运行时类型验证，类型安全 |
| **前端** | React 18 + Vite | 现代化开发体验 |

### 目录结构

```
src/
├── index.ts              # 入口：启动服务、初始化组件
├── config.ts             # 配置：环境变量、默认值
│
├── core/                 # 核心引擎
│   ├── types.ts          # 类型定义：Tool, Handler, Message 等
│   ├── registry.ts       # 注册中心：工具的 CRUD
│   ├── executor.ts       # 执行器：工具调用逻辑
│   └── schemas.ts        # 验证：Zod schemas
│
├── transport/            # 传输层
│   ├── sse.ts            # SSE：MCP 协议端点
│   ├── websocket.ts      # WS：客户端管理、心跳
│   ├── ws-handler.ts     # WS：消息处理
│   └── ws-route.ts       # WS：路由
│
├── api/                  # HTTP API
│   └── tools.ts          # 工具 CRUD + invoke
│
└── web/                  # Web UI
    └── components/       # React 组件
```

---

## 核心技术细节

### 一、工具注册流程

```typescript
// 1. 接收注册请求
POST /api/tools
{
  "name": "my_tool",
  "description": "工具描述",
  "inputSchema": { /* JSON Schema */ },
  "handler": { "type": "websocket", "timeout": 30000 }
}

// 2. 验证 & 存储
const tool = registry.register(validatedRequest)

// 3. 生成 MCP 配置
const config = registry.generateMCPConfig()

// 4. 广播事件
eventEmitter.emit('tool_registered', { tool })
```

### 二、工具执行流程

```typescript
// executor.ts 核心逻辑
async execute(toolName: string, args: Record<string, unknown>) {
  // 1. 查找工具
  const tool = registry.get(toolName)

  // 2. 查找能执行该工具的 WebSocket 客户端
  const clients = clientManager.getClientsWithCapability(toolName)

  // 3. 生成请求 ID
  const requestId = randomUUID()

  // 4. 发送执行请求到客户端
  client.ws.send(JSON.stringify({
    type: 'tool_request',
    requestId,
    tool: toolName,
    arguments: args,
    timeout: tool.handler.timeout
  }))

  // 5. 等待响应（Promise + 超时）
  return new Promise((resolve) => {
    setTimeout(() => resolve({ error: 'TIMEOUT' }), timeout)
    pendingRequests.set(requestId, { resolve, ... })
  })
}
```

### 三、SSE MCP 协议实现

```typescript
// sse.ts 核心逻辑
app.get('/', async (c) => {
  // 1. 创建 MCP Server 实例
  const server = new Server({ name: 'mcp-bridge' }, {
    capabilities: { tools: {} }
  })

  // 2. 注册工具列表处理器
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.getAll().map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }))
  }))

  // 3. 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const result = await executor.execute(req.params.name, req.params.arguments)
    return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  })

  // 4. 建立 SSE 连接
  const transport = new SSEServerTransport('/sse/message', stream)
  await server.connect(transport)
})
```

### 四、WebSocket 消息处理

```typescript
// ws-handler.ts 消息分发
function handleMessage(client: WSClient, data: string) {
  const message = JSON.parse(data)

  switch (message.type) {
    case 'register':
      // 注册客户端能力
      client.capabilities = new Set(message.capabilities)
      client.ws.send(JSON.stringify({ type: 'registered', clientId: client.id }))
      break

    case 'tool_response':
      // 工具执行响应
      executor.handleResponse(message)
      break

    case 'subscribe':
      // 订阅事件
      message.events.forEach(e => client.subscriptions.add(e))
      break

    case 'ping':
      // 心跳响应
      client.lastPingAt = Date.now()
      client.ws.send(JSON.stringify({ type: 'pong' }))
      break
  }
}
```

### 五、事件系统

```typescript
// 事件类型
type EventType = 'tool_invoked' | 'tool_registered' | 'tool_deleted' | 'tool_updated'

// 事件广播
eventEmitter.on('tool_invoked', (data) => {
  clientManager.broadcastEvent('tool_invoked', data)
})

// 客户端订阅
client.subscribe(['tool_invoked'])

// 前端接收
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.type === 'tool_invoked') {
    console.log('工具被调用:', msg.data)
  }
}
```

---

## 快速演示

### 1. 启动服务

```bash
npm install && npm run dev
```

### 2. 注册工具

```bash
curl -X POST http://localhost:3000/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "name": "say_hello",
    "description": "向用户问好",
    "inputSchema": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "description": "用户名" }
      },
      "required": ["name"]
    },
    "handler": { "type": "websocket", "timeout": 30000 }
  }'
```

### 3. 查看已注册工具

```bash
curl http://localhost:3000/api/tools
```

### 4. 测试工具调用

```bash
curl -X POST http://localhost:3000/api/tools/say_hello/invoke \
  -H "Content-Type: application/json" \
  -d '{"name": "张三"}'
```

### 5. 连接 Claude Code

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

---

## 未来规划

### 短期目标

| 功能 | 描述 | 优先级 |
|------|------|--------|
| HTTP Handler | 支持直接调用外部 API | 🔴 高 |
| Static Handler | 返回静态数据 | 🟡 中 |
| React Web UI | 完整管理界面 | 🟡 中 |

### 中期目标

| 功能 | 描述 | 优先级 |
|------|------|--------|
| Resources 模块 | 动态资源注册 | 🟡 中 |
| Prompts 模块 | 提示词模板管理 | 🟡 中 |
| 持久化存储 | SQLite/Redis | 🔴 高 |

### 长期目标

| 功能 | 描述 | 优先级 |
|------|------|--------|
| stdio Transport | 本地进程通信 | 🟢 低 |
| Docker 部署 | 容器化 | 🟡 中 |
| Script Handler | 沙箱脚本执行 | 🟢 低 |

---

## Q&A

### Q: 为什么选择内存存储而不是数据库？

**A:** MVP 阶段优先验证核心功能。内存存储足够满足开发测试需求，后续可无缝升级到 SQLite/Redis。

### Q: 如何保证工具调用的安全性？

**A:**
1. JSON Schema 参数验证
2. 超时机制防止无限等待
3. 客户端能力注册（只通知有能力的客户端）
4. 可扩展：添加认证/授权层

### Q: 与其他 MCP 服务如何共存？

**A:** MCP 支持多服务配置，MCP Bridge 可以与其他 MCP 服务并存：

```json
{
  "mcpServers": {
    "mcp-bridge": { "url": "http://localhost:3000/sse" },
    "filesystem": { "command": "mcp-filesystem", "args": [...] },
    "github": { "command": "mcp-github", "args": [...] }
  }
}
```

### Q: 性能如何？

**A:**
- Hono 框架：轻量高性能
- 内存存储：无 I/O 延迟
- WebSocket：长连接，无握手开销
- 实测：单次工具调用 < 10ms（不含业务执行时间）

---

## 联系方式

- 项目地址：`/Users/admins/zllwork/mcp-bridge`
- 问题反馈：GitHub Issues

---

**感谢聆听！** 🙏