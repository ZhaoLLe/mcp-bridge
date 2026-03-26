# 第一阶段技术方案：Tools 模块（MVP）

## 概述

本文档定义 MCP Bridge 第一阶段（MVP）的完整技术方案，实现核心的动态工具注册与执行能力。

### 架构特点

MCP Bridge 是一个**常驻服务**，同时提供多种接口：

| 接口 | 协议 | 用途 | 客户端 |
|------|------|------|--------|
| HTTP API | REST | 注册工具、返回配置 | 前端项目 |
| WebSocket | WS | 工具执行交互 | 前端项目 |
| MCP Server | SSE | MCP 协议 | Claude Desktop / OpenClaw 等 |

### 核心流程

```
┌──────────────┐                      ┌──────────────┐
│   前端项目    │                      │              │
│              │  1. 注册工具 (HTTP)   │              │
│              │ ────────────────────▶│              │
│              │                      │              │
│              │  2. 返回 MCP 配置     │              │
│              │ ◀──────────────────── │  MCP Bridge  │
│              │                      │   (常驻)      │
│              │  3. 连接 WebSocket    │              │
│              │ ═════════════════════│              │
└──────────────┘                      │              │
                                      │              │
┌──────────────┐                      │              │
│    Claude    │  4. 连接 SSE (MCP)   │              │
│   Desktop    │ ═════════════════════│              │
│              │                      │              │
│              │  5. 调用工具          │              │
│              │ ────────────────────▶│              │
│              │                      │              │
└──────────────┘                      │              │
                                      │              │
┌──────────────┐                      │              │
│   前端项目    │  6. 通知执行 (WS)    │              │
│   (WebSocket)│ ◀──────────────────── │              │
│              │                      │              │
│              │  7. 返回结果          │              │
│              │ ────────────────────▶│              │
└──────────────┘                      │              │
                                      │              │
┌──────────────┐                      │              │
│    Claude    │  8. 返回结果          │              │
│   Desktop    │ ◀──────────────────── │              │
└──────────────┘                      └──────────────┘
```

### 目标

- 通过 HTTP API 动态注册/管理工具，返回 MCP 配置供用户配置到 Claude
- 通过 WebSocket 实现前端执行工具
- 支持 Claude Desktop / OpenClaw 等通过 SSE 连接调用工具

### 范围

| 功能 | 状态 |
|------|------|
| Tools CRUD API | ✅ 实现 |
| WebSocket 协议 | ✅ 实现 |
| MCP Server (SSE) | ✅ 实现 |
| Web UI | ✅ 实现 |
| websocket handler | ✅ 实现 |
| static handler | ❌ 第二阶段 |
| http handler | ❌ 第二阶段 |

---

## 1. 类型定义

### 1.1 核心类型

```typescript
// src/core/types.ts

import { z } from 'zod'

// ==================== Tool 相关 ====================

/**
 * 工具输入参数 Schema（JSON Schema 格式）
 */
export interface InputSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description?: string
    enum?: string[]
    default?: unknown
  }>
  required?: string[]
}

/**
 * WebSocket Handler 配置
 */
export interface WebSocketHandler {
  type: 'websocket'
  action?: string           // 前端识别的操作类型
  timeout?: number          // 超时时间（毫秒），默认 30000
  target?: 'all' | 'first'  // 通知策略
  clientId?: string         // 指定客户端（target=specific 时）
}

/**
 * 工具定义
 */
export interface Tool {
  name: string
  description: string
  inputSchema: InputSchema
  handler: WebSocketHandler
  createdAt: number
  updatedAt: number
}

/**
 * 创建工具请求
 */
export interface CreateToolRequest {
  name: string
  description: string
  inputSchema: InputSchema
  handler: WebSocketHandler
}

/**
 * 更新工具请求
 */
export interface UpdateToolRequest {
  description?: string
  inputSchema?: InputSchema
  handler?: WebSocketHandler
}

/**
 * MCP 配置（返回给前端，供配置到 Claude）
 */
export interface MCPConfig {
  serverName: string
  serverUrl: string
  sseEndpoint: string
  claudeConfig: {
    mcpServers: Record<string, {
      url: string
    }>
  }
  tools: string[]
  createdAt: string
}

// ==================== WebSocket 消息类型 ====================

/**
 * WebSocket 消息基类
 */
export interface WSMessage {
  type: string
}

/**
 * 客户端注册
 */
export interface WSRegisterMessage extends WSMessage {
  type: 'register'
  clientId?: string
  capabilities?: string[]
}

/**
 * 注册确认
 */
export interface WSRegisteredMessage extends WSMessage {
  type: 'registered'
  clientId: string
  timestamp: string
}

/**
 * 心跳请求
 */
export interface WSPingMessage extends WSMessage {
  type: 'ping'
}

/**
 * 心跳响应
 */
export interface WSPongMessage extends WSMessage {
  type: 'pong'
  timestamp: string
}

/**
 * 订阅事件
 */
export interface WSSubscribeMessage extends WSMessage {
  type: 'subscribe'
  events: EventType[]
}

/**
 * 取消订阅
 */
export interface WSUnsubscribeMessage extends WSMessage {
  type: 'unsubscribe'
  events: EventType[]
}

/**
 * 工具执行请求（服务端 -> 客户端）
 */
export interface WSToolRequestMessage extends WSMessage {
  type: 'tool_request'
  requestId: string
  tool: string
  action?: string
  arguments: Record<string, unknown>
  timeout: number
  timestamp: string
}

/**
 * 工具执行响应（客户端 -> 服务端）
 */
export interface WSToolResponseMessage extends WSMessage {
  type: 'tool_response'
  requestId: string
  success: boolean
  result?: unknown
  error?: {
    code: ErrorCode
    message: string
  }
}

/**
 * 事件通知
 */
export interface WSEventMessage extends WSMessage {
  type: EventType
  timestamp: string
  data: unknown
}

/**
 * 错误消息
 */
export interface WSErrorMessage extends WSMessage {
  type: 'error'
  code: ErrorCode
  message: string
}

// ==================== 枚举类型 ====================

export type EventType =
  | 'tool_invoked'
  | 'tool_registered'
  | 'tool_deleted'

export type ErrorCode =
  | 'INVALID_MESSAGE'
  | 'UNKNOWN_MESSAGE_TYPE'
  | 'NOT_REGISTERED'
  | 'CLIENT_OFFLINE'
  | 'TIMEOUT'
  | 'EXECUTION_FAILED'
  | 'REJECTED'
  | 'UNKNOWN_TOOL'

// ==================== 客户端状态 ====================

/**
 * WebSocket 客户端信息
 */
export interface WSClient {
  id: string
  ws: WebSocket
  capabilities: Set<string>
  subscriptions: Set<EventType>
  registeredAt: number
  lastPingAt: number
}

/**
 * 待处理的工具请求
 */
export interface PendingRequest {
  requestId: string
  toolName: string
  arguments: Record<string, unknown>
  handler: WebSocketHandler
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
  createdAt: number
}

// ==================== API 响应类型 ====================

/**
 * 统一 API 响应
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

/**
 * 工具列表响应
 */
export interface ToolListResponse {
  tools: Tool[]
  total: number
}

/**
 * 注册工具响应（包含 MCP 配置）
 */
export interface RegisterToolResponse {
  tool: Tool
  mcpConfig: MCPConfig
}

/**
 * 工具调用结果
 */
export interface ToolInvokeResult {
  tool: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: {
    code: string
    message: string
  }
  duration: number
}
```

### 1.2 Zod Schema（请求校验）

```typescript
// src/core/schemas.ts

import { z } from 'zod'

export const InputSchemaZod = z.object({
  type: z.literal('object'),
  properties: z.record(z.object({
    type: z.string(),
    description: z.string().optional(),
    enum: z.array(z.string()).optional(),
    default: z.unknown().optional()
  })),
  required: z.array(z.string()).optional()
})

export const WebSocketHandlerSchema = z.object({
  type: z.literal('websocket'),
  action: z.string().optional(),
  timeout: z.number().int().min(1000).max(300000).optional(),
  target: z.enum(['all', 'first']).optional(),
  clientId: z.string().optional()
})

export const CreateToolSchema = z.object({
  name: z.string()
    .min(1, '工具名称不能为空')
    .max(64, '工具名称最长 64 字符')
    .regex(/^[a-z][a-z0-9_]*$/, '工具名称必须以小写字母开头，只能包含小写字母、数字和下划线'),
  description: z.string()
    .min(1, '描述不能为空')
    .max(1024, '描述最长 1024 字符'),
  inputSchema: InputSchemaZod,
  handler: WebSocketHandlerSchema
})

export const UpdateToolSchema = z.object({
  description: z.string().min(1).max(1024).optional(),
  inputSchema: InputSchemaZod.optional(),
  handler: WebSocketHandlerSchema.optional()
})
```

---

## 2. 核心模块设计

### 2.1 Registry（工具注册中心）

```typescript
// src/core/registry.ts

import type { Tool, CreateToolRequest, UpdateToolRequest, MCPConfig } from './types'

/**
 * 工具注册中心
 * 使用内存 Map 存储工具定义
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()
  private serverUrl: string
  private serverName: string

  constructor(serverUrl: string = 'http://localhost:3000', serverName: string = 'mcp-bridge') {
    this.serverUrl = serverUrl
    this.serverName = serverName
  }

  /**
   * 注册工具
   */
  register(request: CreateToolRequest): Tool {
    if (this.tools.has(request.name)) {
      throw new Error(`Tool '${request.name}' already exists`)
    }

    const now = Date.now()
    const tool: Tool = {
      name: request.name,
      description: request.description,
      inputSchema: request.inputSchema,
      handler: request.handler,
      createdAt: now,
      updatedAt: now
    }

    this.tools.set(request.name, tool)
    return tool
  }

  /**
   * 获取工具
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * 获取所有工具
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * 更新工具
   */
  update(name: string, request: UpdateToolRequest): Tool {
    const existing = this.tools.get(name)
    if (!existing) {
      throw new Error(`Tool '${name}' not found`)
    }

    const updated: Tool = {
      ...existing,
      description: request.description ?? existing.description,
      inputSchema: request.inputSchema ?? existing.inputSchema,
      handler: request.handler ?? existing.handler,
      updatedAt: Date.now()
    }

    this.tools.set(name, updated)
    return updated
  }

  /**
   * 删除工具
   */
  delete(name: string): boolean {
    return this.tools.delete(name)
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 获取工具数量
   */
  get count(): number {
    return this.tools.size
  }

  /**
   * 生成 MCP 配置（供前端复制到 Claude）
   */
  generateMCPConfig(): MCPConfig {
    const sseEndpoint = `${this.serverUrl}/sse`

    return {
      serverName: this.serverName,
      serverUrl: this.serverUrl,
      sseEndpoint,
      claudeConfig: {
        mcpServers: {
          [this.serverName]: {
            url: sseEndpoint
          }
        }
      },
      tools: this.getAll().map(t => t.name),
      createdAt: new Date().toISOString()
    }
  }
}
```

### 2.2 Executor（工具执行器）

```typescript
// src/core/executor.ts

import type { Tool, PendingRequest, ErrorCode, WSToolRequestMessage, WSClient } from './types'
import { ToolRegistry } from './registry'
import { WSClientManager } from '../transport/websocket'
import { randomUUID } from 'crypto'

export class ToolExecutor {
  private pendingRequests: Map<string, PendingRequest> = new Map()

  constructor(
    private registry: ToolRegistry,
    private clientManager: WSClientManager
  ) {}

  /**
   * 执行工具
   */
  async execute(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: { code: ErrorCode; message: string } }> {
    // 1. 查找工具
    const tool = this.registry.get(toolName)
    if (!tool) {
      return {
        success: false,
        error: { code: 'UNKNOWN_TOOL', message: `Tool '${toolName}' not found` }
      }
    }

    // 2. 校验参数（TODO: 使用 JSON Schema 校验）

    // 3. 根据 handler 类型执行
    const handler = tool.handler

    if (handler.type === 'websocket') {
      return this.executeWebSocket(tool, args)
    }

    return {
      success: false,
      error: { code: 'EXECUTION_FAILED', message: `Unknown handler type: ${handler.type}` }
    }
  }

  /**
   * WebSocket Handler 执行
   */
  private async executeWebSocket(
    tool: Tool,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: { code: ErrorCode; message: string } }> {
    const handler = tool.handler
    const timeout = handler.timeout ?? 30000

    // 1. 查找可执行该工具的客户端
    const clients = this.clientManager.getClientsWithCapability(tool.name)

    if (clients.length === 0) {
      return {
        success: false,
        error: { code: 'CLIENT_OFFLINE', message: `No client connected for tool '${tool.name}'` }
      }
    }

    // 2. 选择目标客户端
    let targetClients: WSClient[] = []
    if (handler.target === 'first') {
      targetClients = [clients[0]]
    } else {
      targetClients = clients // 'all'
    }

    // 3. 发送执行请求
    const requestId = randomUUID()
    const request: WSToolRequestMessage = {
      type: 'tool_request',
      requestId,
      tool: tool.name,
      action: handler.action,
      arguments: args,
      timeout,
      timestamp: new Date().toISOString()
    }

    // 4. 等待响应
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        resolve({
          success: false,
          error: { code: 'TIMEOUT', message: `Tool execution timed out after ${timeout}ms` }
        })
      }, timeout)

      this.pendingRequests.set(requestId, {
        requestId,
        toolName: tool.name,
        arguments: args,
        handler,
        resolve: (result) => {
          clearTimeout(timeoutId)
          this.pendingRequests.delete(requestId)
          resolve({ success: true, result })
        },
        reject: (error) => {
          clearTimeout(timeoutId)
          this.pendingRequests.delete(requestId)
          resolve({
            success: false,
            error: { code: 'EXECUTION_FAILED', message: error.message }
          })
        },
        timeout: timeoutId,
        createdAt: Date.now()
      })

      // 发送给目标客户端
      for (const client of targetClients) {
        client.ws.send(JSON.stringify(request))
      }
    })
  }

  /**
   * 处理客户端响应
   */
  handleResponse(message: WSToolResponseMessage): void {
    const pending = this.pendingRequests.get(message.requestId)
    if (!pending) {
      // 可能已超时或不存在
      return
    }

    if (message.success) {
      pending.resolve(message.result)
    } else {
      pending.reject(new Error(message.error?.message ?? 'Unknown error'))
    }
  }

  /**
   * 获取待处理请求数量
   */
  get pendingCount(): number {
    return this.pendingRequests.size
  }
}
```

---

## 3. HTTP API 设计

### 3.1 路由实现

```typescript
// src/api/tools.ts

import { Hono } from 'hono'
import { z } from 'zod'
import { ToolRegistry } from '../core/registry'
import { ToolExecutor } from '../core/executor'
import { CreateToolSchema, UpdateToolSchema } from '../core/schemas'
import type { ApiResponse, ToolListResponse, ToolInvokeResult, RegisterToolResponse } from '../core/types'

export function createToolsRoutes(
  registry: ToolRegistry,
  executor: ToolExecutor,
  eventEmitter: EventEmitter
) {
  const app = new Hono()

  // 列出所有工具
  app.get('/', (c) => {
    const tools = registry.getAll()
    const response: ApiResponse<ToolListResponse> = {
      success: true,
      data: { tools, total: tools.length }
    }
    return c.json(response)
  })

  // 获取单个工具
  app.get('/:name', (c) => {
    const name = c.req.param('name')
    const tool = registry.get(name)

    if (!tool) {
      const response: ApiResponse = {
        success: false,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool '${name}' not found` }
      }
      return c.json(response, 404)
    }

    return c.json({ success: true, data: tool })
  })

  // 注册工具（返回 MCP 配置）
  app.post('/', async (c) => {
    try {
      const body = await c.req.json()
      const validated = CreateToolSchema.parse(body)

      const tool = registry.register(validated)

      // 生成 MCP 配置
      const mcpConfig = registry.generateMCPConfig()

      // 触发事件
      eventEmitter.emit('tool_registered', { tool })

      const response: ApiResponse<RegisterToolResponse> = {
        success: true,
        data: {
          tool,
          mcpConfig
        }
      }

      return c.json(response, 201)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return c.json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: err.errors[0].message }
        }, 400)
      }
      if (err instanceof Error) {
        return c.json({
          success: false,
          error: { code: 'DUPLICATE_TOOL', message: err.message }
        }, 409)
      }
      throw err
    }
  })

  // 更新工具
  app.put('/:name', async (c) => {
    const name = c.req.param('name')

    try {
      const body = await c.req.json()
      const validated = UpdateToolSchema.parse(body)

      const tool = registry.update(name, validated)

      eventEmitter.emit('tool_updated', { tool })

      return c.json({ success: true, data: tool })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return c.json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: err.errors[0].message }
        }, 400)
      }
      if (err instanceof Error && err.message.includes('not found')) {
        return c.json({
          success: false,
          error: { code: 'TOOL_NOT_FOUND', message: err.message }
        }, 404)
      }
      throw err
    }
  })

  // 删除工具
  app.delete('/:name', (c) => {
    const name = c.req.param('name')
    const deleted = registry.delete(name)

    if (!deleted) {
      return c.json({
        success: false,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool '${name}' not found` }
      }, 404)
    }

    eventEmitter.emit('tool_deleted', { toolName: name })

    return c.json({ success: true })
  })

  // 调用工具（测试用）
  app.post('/:name/invoke', async (c) => {
    const name = c.req.param('name')
    const args = await c.req.json().catch(() => ({}))

    const startTime = Date.now()
    const result = await executor.execute(name, args)
    const duration = Date.now() - startTime

    const response: ApiResponse<ToolInvokeResult> = {
      success: result.success,
      data: {
        tool: name,
        arguments: args,
        result: result.result,
        error: result.error,
        duration
      }
    }

    // 触发事件
    eventEmitter.emit('tool_invoked', {
      tool: name,
      arguments: args,
      result: result.result,
      error: result.error,
      duration
    })

    return c.json(response, result.success ? 200 : 500)
  })

  // 获取 MCP 配置
  app.get('/mcp-config', (c) => {
    const mcpConfig = registry.generateMCPConfig()
    return c.json({ success: true, data: mcpConfig })
  })

  return app
}
```

### 3.2 API 端点汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tools` | 列出所有工具 |
| GET | `/api/tools/:name` | 获取单个工具 |
| POST | `/api/tools` | 注册工具（返回 MCP 配置） |
| PUT | `/api/tools/:name` | 更新工具 |
| DELETE | `/api/tools/:name` | 删除工具 |
| POST | `/api/tools/:name/invoke` | 调用工具（测试用） |
| GET | `/api/tools/mcp-config` | 获取 MCP 配置 |

### 3.3 注册工具响应示例

```json
{
  "success": true,
  "data": {
    "tool": {
      "name": "get_weather",
      "description": "获取天气信息",
      "inputSchema": {
        "type": "object",
        "properties": {
          "city": { "type": "string", "description": "城市名称" }
        },
        "required": ["city"]
      },
      "handler": {
        "type": "websocket",
        "action": "fetchWeather",
        "timeout": 30000
      },
      "createdAt": 1711353600000,
      "updatedAt": 1711353600000
    },
    "mcpConfig": {
      "serverName": "mcp-bridge",
      "serverUrl": "http://localhost:3000",
      "sseEndpoint": "http://localhost:3000/sse",
      "claudeConfig": {
        "mcpServers": {
          "mcp-bridge": {
            "url": "http://localhost:3000/sse"
          }
        }
      },
      "tools": ["get_weather"],
      "createdAt": "2024-03-25T10:00:00.000Z"
    }
  }
}
```

---

## 4. WebSocket 服务设计

### 4.1 客户端管理器

```typescript
// src/transport/websocket.ts

import type { WSClient, WSMessage, EventType, ErrorCode } from '../core/types'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'

export class WSClientManager extends EventEmitter {
  private clients: Map<string, WSClient> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(private heartbeatMs: number = 30000) {
    super()
  }

  /**
   * 添加客户端
   */
  addClient(ws: WebSocket): WSClient {
    const id = randomUUID()
    const client: WSClient = {
      id,
      ws,
      capabilities: new Set(),
      subscriptions: new Set(),
      registeredAt: Date.now(),
      lastPingAt: Date.now()
    }

    this.clients.set(id, client)
    this.emit('client_connected', client)

    return client
  }

  /**
   * 移除客户端
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId)
    if (client) {
      this.clients.delete(clientId)
      this.emit('client_disconnected', client)
    }
  }

  /**
   * 注册客户端
   */
  registerClient(client: WSClient, clientId?: string, capabilities?: string[]): void {
    if (clientId) {
      // 使用自定义 ID
      this.clients.delete(client.id)
      client.id = clientId
      this.clients.set(clientId, client)
    }

    if (capabilities) {
      client.capabilities = new Set(capabilities)
    }

    this.emit('client_registered', client)
  }

  /**
   * 获取客户端
   */
  getClient(clientId: string): WSClient | undefined {
    return this.clients.get(clientId)
  }

  /**
   * 获取所有客户端
   */
  getAllClients(): WSClient[] {
    return Array.from(this.clients.values())
  }

  /**
   * 获取具有指定能力的客户端
   */
  getClientsWithCapability(capability: string): WSClient[] {
    return this.getAllClients().filter(c =>
      c.capabilities.has(capability) || c.capabilities.has('*')
    )
  }

  /**
   * 订阅事件
   */
  subscribe(client: WSClient, events: EventType[]): void {
    for (const event of events) {
      client.subscriptions.add(event)
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(client: WSClient, events: EventType[]): void {
    for (const event of events) {
      client.subscriptions.delete(event)
    }
  }

  /**
   * 广播事件给订阅者
   */
  broadcast(eventType: EventType, data: unknown): void {
    const message = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data
    }

    for (const client of this.clients.values()) {
      if (client.subscriptions.has(eventType)) {
        client.ws.send(JSON.stringify(message))
      }
    }
  }

  /**
   * 发送错误消息
   */
  sendError(ws: WebSocket, code: ErrorCode, message: string): void {
    ws.send(JSON.stringify({
      type: 'error',
      code,
      message
    }))
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      for (const client of this.clients.values()) {
        // 检查超时（心跳间隔 * 2）
        if (now - client.lastPingAt > this.heartbeatMs * 2) {
          this.removeClient(client.id)
          client.ws.close()
        }
      }
    }, this.heartbeatMs)
  }

  /**
   * 停止心跳检测
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * 获取客户端数量
   */
  get clientCount(): number {
    return this.clients.size
  }
}
```

### 4.2 WebSocket 消息处理器

```typescript
// src/transport/ws-handler.ts

import type {
  WSClient,
  WSMessage,
  WSRegisterMessage,
  WSPingMessage,
  WSSubscribeMessage,
  WSUnsubscribeMessage,
  WSToolResponseMessage
} from '../core/types'
import { WSClientManager } from './websocket'
import { ToolExecutor } from '../core/executor'

export function createWSMessageHandler(
  clientManager: WSClientManager,
  executor: ToolExecutor
) {
  return (client: WSClient, data: string) => {
    let message: WSMessage

    try {
      message = JSON.parse(data)
    } catch {
      clientManager.sendError(client.ws, 'INVALID_MESSAGE', 'Invalid JSON format')
      return
    }

    if (!message.type) {
      clientManager.sendError(client.ws, 'INVALID_MESSAGE', "Message must include 'type' field")
      return
    }

    switch (message.type) {
      case 'register':
        handleRegister(clientManager, client, message as WSRegisterMessage)
        break

      case 'ping':
        handlePing(clientManager, client)
        break

      case 'subscribe':
        handleSubscribe(clientManager, client, message as WSSubscribeMessage)
        break

      case 'unsubscribe':
        handleUnsubscribe(clientManager, client, message as WSUnsubscribeMessage)
        break

      case 'tool_response':
        handleToolResponse(executor, message as WSToolResponseMessage)
        break

      default:
        clientManager.sendError(client.ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`)
    }
  }
}

function handleRegister(
  clientManager: WSClientManager,
  client: WSClient,
  message: WSRegisterMessage
): void {
  clientManager.registerClient(client, message.clientId, message.capabilities)

  client.ws.send(JSON.stringify({
    type: 'registered',
    clientId: client.id,
    timestamp: new Date().toISOString()
  }))
}

function handlePing(clientManager: WSClientManager, client: WSClient): void {
  client.lastPingAt = Date.now()
  client.ws.send(JSON.stringify({
    type: 'pong',
    timestamp: new Date().toISOString()
  }))
}

function handleSubscribe(
  clientManager: WSClientManager,
  client: WSClient,
  message: WSSubscribeMessage
): void {
  clientManager.subscribe(client, message.events)
  client.ws.send(JSON.stringify({
    type: 'subscribed',
    events: message.events,
    timestamp: new Date().toISOString()
  }))
}

function handleUnsubscribe(
  clientManager: WSClientManager,
  client: WSClient,
  message: WSUnsubscribeMessage
): void {
  clientManager.unsubscribe(client, message.events)
  client.ws.send(JSON.stringify({
    type: 'unsubscribed',
    events: message.events,
    timestamp: new Date().toISOString()
  }))
}

function handleToolResponse(
  executor: ToolExecutor,
  message: WSToolResponseMessage
): void {
  executor.handleResponse(message)
}
```

### 4.3 Hono WebSocket 集成

```typescript
// src/transport/ws-route.ts

import { Hono } from 'hono'
import { WSClientManager } from './websocket'
import { createWSMessageHandler } from './ws-handler'
import { ToolExecutor } from '../core/executor'

export function createWSRoute(
  clientManager: WSClientManager,
  executor: ToolExecutor
) {
  const app = new Hono()

  app.get('/', (c) => {
    // 检查是否是 WebSocket 升级请求
    if (c.req.header('upgrade') !== 'websocket') {
      return c.json({ error: 'Expected WebSocket' }, 426)
    }

    // Hono WebSocket 处理
    return c.websocket((ws) => {
      // 添加客户端
      const client = clientManager.addClient(ws)

      // 发送欢迎消息
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Please register with your capabilities',
        timestamp: new Date().toISOString()
      }))

      // 消息处理
      const handler = createWSMessageHandler(clientManager, executor)
      ws.on('message', (data) => {
        handler(client, data.toString())
      })

      // 关闭处理
      ws.on('close', () => {
        clientManager.removeClient(client.id)
      })

      // 错误处理
      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        clientManager.removeClient(client.id)
      })
    })
  })

  return app
}
```

---

## 5. MCP SSE Server 设计

### 5.1 SSE MCP 服务器

MCP Bridge 作为常驻服务，通过 SSE (Server-Sent Events) 提供 MCP 协议支持。

```typescript
// src/transport/sse.ts

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import type { ToolRegistry } from '../core/registry'
import type { ToolExecutor } from '../core/executor'
import { randomUUID } from 'crypto'

interface SSESession {
  id: string
  controller: ReadableStreamDefaultController
}

export function createSSERoute(
  registry: ToolRegistry,
  executor: ToolExecutor
) {
  const app = new Hono()
  const sessions: Map<string, SSESession> = new Map()

  // 创建 MCP Server 实例（每个连接一个）
  function createMCPServer() {
    const server = new Server(
      { name: 'mcp-bridge', version: '1.0.0' },
      { capabilities: { tools: {} } }
    )

    // 列出工具
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = registry.getAll()

      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      }
    })

    // 调用工具
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      const result = await executor.execute(name, args || {})

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.result, null, 2)
            }
          ]
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${result.error?.message}`
            }
          ],
          isError: true
        }
      }
    })

    return server
  }

  // SSE 端点
  app.get('/', async (c) => {
    const sessionId = randomUUID()

    return streamSSE(c, async (stream) => {
      // 发送端点信息
      await stream.writeSSE({
        event: 'endpoint',
        data: JSON.stringify({
          endpoint: `/sse/${sessionId}/message`,
          sessionId
        })
      })

      // 存储会话
      sessions.set(sessionId, {
        id: sessionId,
        controller: stream.controller
      })

      // 保持连接
      // MCP 客户端会通过 POST 到 message 端点发送请求
    })
  })

  // MCP 消息端点（POST）
  app.post('/:sessionId/message', async (c) => {
    const sessionId = c.req.param('sessionId')
    const session = sessions.get(sessionId)

    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    const body = await c.req.json()

    // 处理 MCP 请求并返回响应
    // 这里需要与 MCP Server 集成
    // 具体实现取决于 MCP SDK 的 SSE transport

    return c.json({ received: true })
  })

  return app
}

/**
 * 创建 MCP SSE Transport（使用 @modelcontextprotocol/sdk）
 */
export async function createMCPSSEServer(
  registry: ToolRegistry,
  executor: ToolExecutor,
  port: number
) {
  // 使用 MCP SDK 的 SSE transport
  // 参考: https://github.com/modelcontextprotocol/typescript-sdk

  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js')
  const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js')

  const server = new Server(
    { name: 'mcp-bridge', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  // 列出工具
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = registry.getAll()
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    }
  })

  // 调用工具
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const result = await executor.execute(name, args || {})

    if (result.success) {
      return {
        content: [{ type: 'text', text: JSON.stringify(result.result, null, 2) }]
      }
    } else {
      return {
        content: [{ type: 'text', text: `Error: ${result.error?.message}` }],
        isError: true
      }
    }
  })

  return server
}
```

### 5.2 Claude Desktop 配置

用户在前端注册工具后，将返回的配置复制到 Claude Desktop：

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "mcp-bridge": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

### 5.3 OpenClaw 配置

OpenClaw 等支持 MCP 的工具同样使用 SSE URL：

```yaml
# openclaw 配置
mcp_servers:
  mcp-bridge:
    url: http://localhost:3000/sse
```

---

## 6. 服务器入口

```typescript
// src/index.ts

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/static'
import { EventEmitter } from 'events'
import { ToolRegistry } from './core/registry'
import { ToolExecutor } from './core/executor'
import { WSClientManager } from './transport/websocket'
import { createWSRoute } from './transport/ws-route'
import { createToolsRoutes } from './api/tools'
import { createMCPSSEServer } from './transport/sse'
import { config } from './config'

async function main() {
  // 初始化核心组件
  const registry = new ToolRegistry(config.serverUrl, config.mcp.name)
  const clientManager = new WSClientManager(config.websocket.heartbeat)
  const executor = new ToolExecutor(registry, clientManager)
  const eventEmitter = new EventEmitter()

  // 事件广播
  eventEmitter.on('tool_invoked', (data) => {
    clientManager.broadcast('tool_invoked', data)
  })
  eventEmitter.on('tool_registered', (data) => {
    clientManager.broadcast('tool_registered', data)
  })
  eventEmitter.on('tool_deleted', (data) => {
    clientManager.broadcast('tool_deleted', data)
  })

  // 创建 Hono 应用
  const app = new Hono()

  // CORS
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  }))

  // API 路由
  app.route('/api/tools', createToolsRoutes(registry, executor, eventEmitter))

  // WebSocket 路由
  app.route('/ws', createWSRoute(clientManager, executor))

  // SSE MCP 路由
  app.route('/sse', await createSSERoute(registry, executor))

  // 健康检查
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // 静态文件（Web UI）
  app.use('/*', serveStatic({ root: './dist/web' }))

  // 启动心跳检测
  clientManager.startHeartbeat()

  // 启动 MCP SSE Server
  await createMCPSSEServer(registry, executor, config.port)

  // 启动 HTTP 服务器
  console.log(`MCP Bridge server started on ${config.serverUrl}`)
  console.log(`  - HTTP API: ${config.serverUrl}/api/tools`)
  console.log(`  - WebSocket: ${config.serverUrl}/ws`)
  console.log(`  - MCP SSE: ${config.serverUrl}/sse`)
  console.log(`  - Web UI: ${config.serverUrl}`)

  Bun.serve({
    fetch: app.fetch,
    port: config.port
  })
}

main().catch(console.error)
```

---

## 7. Web UI 设计

### 7.1 页面结构

```
┌─────────────────────────────────────────────────────────────────┐
│  MCP Bridge                                    [状态: 已连接]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ 工具列表     │  │ 工具详情     │  │ MCP 配置                 │ │
│  │             │  │             │  │                         │ │
│  │ + 注册工具   │  │ 名称: xxx   │  │ Claude 配置:            │ │
│  │             │  │ 描述: xxx   │  │ {                       │ │
│  │ - tool_1    │  │ 参数: ...   │  │   "mcpServers": {...}   │ │
│  │ - tool_2    │  │ handler: ...│  │ }                       │ │
│  │ - tool_3    │  │             │  │                         │ │
│  │             │  │ [测试调用]   │  │ [复制配置]               │ │
│  │             │  │ [删除]       │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 执行面板（等待 Claude 调用）                                   ││
│  │                                                              ││
│  │ [当前无待处理请求]                                            ││
│  │                                                              ││
│  │ 当 Claude 调用工具时，会在这里显示执行请求                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 调用日志                                                      ││
│  │ [10:00:01] tool_invoked: get_weather { city: "北京" }        ││
│  │ [10:00:05] tool_response: get_weather { temp: 25 }           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 组件设计

```typescript
// src/web/App.tsx

import { useState, useEffect } from 'react'
import { ToolsPanel } from './components/ToolsPanel'
import { ExecutionPanel } from './components/ExecutionPanel'
import { MCPConfigPanel } from './components/MCPConfigPanel'
import { LogPanel } from './components/LogPanel'
import { useWebSocket } from './hooks/useWebSocket'
import { useApi } from './hooks/useApi'

export function App() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [mcpConfig, setMcpConfig] = useState<object | null>(null)

  const { connected, clientId, onToolRequest, respond } = useWebSocket()
  const { tools, mcpConfig: fetchMcpConfig, refreshTools, createTool, deleteTool, invokeTool } = useApi()

  // 获取 MCP 配置
  useEffect(() => {
    fetchMcpConfig().then(setMcpConfig)
  }, [tools])

  // 监听工具调用请求
  useEffect(() => {
    const unsubscribe = onToolRequest((request) => {
      addLog('tool_request', request)
    })
    return unsubscribe
  }, [onToolRequest])

  const addLog = (type: string, data: unknown) => {
    setLogs(prev => [...prev, {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type,
      data
    }])
  }

  return (
    <div className="app">
      <header>
        <h1>MCP Bridge</h1>
        <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? `已连接 (${clientId})` : '未连接'}
        </span>
      </header>

      <main>
        <div className="row">
          <div className="panel">
            <ToolsPanel
              tools={tools}
              selectedTool={selectedTool}
              onSelect={setSelectedTool}
              onCreate={createTool}
              onDelete={deleteTool}
              onRefresh={refreshTools}
            />
          </div>

          <div className="panel">
            <MCPConfigPanel config={mcpConfig} />
          </div>
        </div>

        <div className="panel full-width">
          <ExecutionPanel onRespond={respond} />
        </div>

        <div className="panel full-width">
          <LogPanel logs={logs} />
        </div>
      </main>
    </div>
  )
}
```

### 7.3 MCP 配置面板

```typescript
// src/web/components/MCPConfigPanel.tsx

import { useState } from 'react'

interface Props {
  config: object | null
}

export function MCPConfigPanel({ config }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!config) return

    const configStr = JSON.stringify(config.claudeConfig, null, 2)
    await navigator.clipboard.writeText(configStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!config) {
    return <div className="mcp-config-panel">加载中...</div>
  }

  return (
    <div className="mcp-config-panel">
      <h3>Claude Desktop 配置</h3>
      <p className="hint">复制以下配置到 Claude Desktop 配置文件：</p>
      <code className="config-block">
        {JSON.stringify(config.claudeConfig, null, 2)}
      </code>
      <div className="actions">
        <button onClick={handleCopy}>
          {copied ? '已复制!' : '复制配置'}
        </button>
      </div>
      <div className="config-info">
        <p><strong>SSE 端点:</strong> {config.sseEndpoint}</p>
        <p><strong>已注册工具:</strong> {config.tools.join(', ') || '无'}</p>
      </div>
    </div>
  )
}
```

---

## 8. 执行流程图

### 8.1 完整流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              完整调用流程                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ① 前端注册工具                                                              │
│  ┌──────────┐     POST /api/tools      ┌──────────┐                        │
│  │  前端项目  │ ──────────────────────▶ │          │                        │
│  │          │                          │          │                        │
│  │          │ ◀────────────────────── │          │                        │
│  │          │   Tool + MCP Config      │          │                        │
│  └──────────┘                          │          │                        │
│                                        │          │                        │
│  ② 前端连接 WebSocket                    │          │                        │
│  ┌──────────┐     WS /ws               │          │                        │
│  │  前端项目  │ ═══════════════════════ │  MCP     │                        │
│  │          │     register             │  Bridge  │                        │
│  │          │ ────────────────────────▶│          │                        │
│  │          │                          │          │                        │
│  ③ 用户配置 Claude                       │          │                        │
│  ┌──────────┐                          │          │                        │
│  │   用户    │ 复制配置到 Claude         │          │                        │
│  │          │ ──────────────────────────▶│          │                        │
│  └──────────┘                          │          │                        │
│                                        │          │                        │
│  ④ Claude 连接 SSE                      │          │                        │
│  ┌──────────┐     GET /sse             │          │                        │
│  │  Claude  │ ═════════════════════════ │          │                        │
│  │ Desktop  │                          │          │                        │
│  └──────────┘                          │          │                        │
│                                        │          │                        │
│  ⑤ Claude 调用工具                      │          │                        │
│  ┌──────────┐     tools/call           │          │                        │
│  │  Claude  │ ────────────────────────▶│          │                        │
│  │ Desktop  │                          │          │                        │
│  └──────────┘                          │          │                        │
│                                        │          │                        │
│  ⑥ MCP Bridge 通知前端                  │          │                        │
│                                        │          │                        │
│  ┌──────────┐     tool_request         │          │                        │
│  │  前端项目  │ ◀─────────────────────── │          │                        │
│  │  (WS)    │                          │          │                        │
│  │          │ ────────────────────────▶│          │                        │
│  │          │   tool_response          │          │                        │
│  └──────────┘                          │          │                        │
│                                        │          │                        │
│  ⑦ 返回结果给 Claude                     │          │                        │
│  ┌──────────┐                          │          │                        │
│  │  Claude  │ ◀─────────────────────── │          │                        │
│  │ Desktop  │   result                 │          │                        │
│  └──────────┘                          └──────────┘                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 工具注册流程

```
┌─────────┐          ┌─────────┐          ┌──────────┐
│ 前端项目 │          │  HTTP   │          │ Registry │
│         │          │  API    │          │          │
└────┬────┘          └────┬────┘          └────┬─────┘
     │                    │                    │
     │ POST /api/tools    │                    │
     │ { name, handler }  │                    │
     │───────────────────▶│                    │
     │                    │                    │
     │                    │ register(tool)     │
     │                    │───────────────────▶│
     │                    │                    │
     │                    │ generateMCPConfig()│
     │                    │───────────────────▶│
     │                    │                    │
     │                    │    tool + config   │
     │                    │◀───────────────────│
     │                    │                    │
     │         201 Created│                    │
     │   { tool, mcpConfig}│                   │
     │◀───────────────────│                    │
     │                    │                    │
     │                    │ emit('tool_registered')
     │                    │────────────────────┼──────▶ WebSocket 广播
     │                    │                    │
```

### 8.3 工具调用流程

```
┌─────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐
│ Claude  │    │   SSE   │    │ Executor │    │   WS    │    │ 前端项目 │
│Desktop  │    │  Route  │    │          │    │ Manager │    │   (WS)  │
└────┬────┘    └────┬────┘    └────┬─────┘    └────┬────┘    └────┬────┘
     │              │              │               │              │
     │ tools/call   │              │               │              │
     │ { name, args }              │               │              │
     │─────────────▶│              │               │              │
     │              │              │               │              │
     │              │ execute()    │               │              │
     │              │─────────────▶│               │              │
     │              │              │               │              │
     │              │              │ find clients  │               │
     │              │              │──────────────▶│              │
     │              │              │               │              │
     │              │              │   [clients]   │              │
     │              │              │◀──────────────│              │
     │              │              │               │              │
     │              │              │ tool_request  │              │
     │              │              │───────────────┼─────────────▶│
     │              │              │               │              │
     │              │              │               │  用户操作     │
     │              │              │               │              │
     │              │              │               │ tool_response│
     │              │              │◀──────────────┼──────────────│
     │              │              │               │              │
     │              │   result     │               │              │
     │              │◀─────────────│               │              │
     │              │              │               │              │
     │   result     │              │               │              │
     │◀─────────────│              │               │              │
     │              │              │               │              │
```

---

## 9. 配置文件

```typescript
// src/config.ts

export const config = {
  port: parseInt(process.env.MCP_BRIDGE_PORT || '3000', 10),
  serverUrl: process.env.MCP_BRIDGE_URL || 'http://localhost:3000',

  mcp: {
    name: process.env.MCP_NAME || 'mcp-bridge',
    version: '1.0.0'
  },

  websocket: {
    path: '/ws',
    heartbeat: 30000
  }
}
```

---

## 10. 文件结构

```
mcp-bridge/
├── src/
│   ├── index.ts                    # 入口
│   ├── config.ts                   # 配置
│   │
│   ├── core/
│   │   ├── types.ts                # 类型定义
│   │   ├── schemas.ts              # Zod 校验
│   │   ├── registry.ts             # 工具注册中心
│   │   └── executor.ts             # 工具执行器
│   │
│   ├── transport/
│   │   ├── sse.ts                  # MCP SSE 服务器
│   │   ├── websocket.ts            # WebSocket 客户端管理
│   │   ├── ws-handler.ts           # 消息处理器
│   │   └── ws-route.ts             # WebSocket 路由
│   │
│   ├── api/
│   │   └── tools.ts                # Tools API 路由
│   │
│   └── web/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── ToolsPanel.tsx      # 工具列表面板
│       │   ├── ToolDetail.tsx      # 工具详情
│       │   ├── MCPConfigPanel.tsx  # MCP 配置面板
│       │   ├── ExecutionPanel.tsx  # 执行面板
│       │   ├── LogPanel.tsx        # 日志面板
│       │   └── CreateToolModal.tsx # 创建工具弹窗
│       └── hooks/
│           ├── useWebSocket.ts     # WebSocket hook
│           └── useApi.ts           # API hook
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 11. 依赖清单

```json
{
  "dependencies": {
    "hono": "^4.0.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@types/bun": "latest",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0"
  }
}
```

---

## 12. 实现顺序

| 步骤 | 内容 | 预估 |
|------|------|------|
| 1 | 项目初始化 + 依赖安装 | 0.5h |
| 2 | 类型定义 + Zod Schema | 1h |
| 3 | Registry 实现（含 MCP 配置生成） | 1.5h |
| 4 | HTTP API 实现 | 2h |
| 5 | WebSocket 服务实现 | 3h |
| 6 | MCP SSE 实现 | 2.5h |
| 7 | Executor 实现 | 2h |
| 8 | Web UI 实现 | 4h |
| 9 | 集成测试 | 2h |
| 10 | 文档完善 | 1h |

**总计：约 19.5 小时**

---

## 13. 关键决策

| 决策 | 原因 |
|------|------|
| 使用 SSE 而非 stdio | MCP Bridge 需要常驻运行，stdio 模式需要由 Claude 启动进程 |
| 单进程混合模式 | HTTP + WebSocket + SSE 可以在同一个进程中运行，简化部署 |
| 注册时返回 MCP 配置 | 用户可以一键复制配置到 Claude Desktop |
| 使用 Bun 运行时 | 内置 WebSocket 支持，启动快，适合 I/O 密集场景 |