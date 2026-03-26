/**
 * MCP Bridge 核心类型定义
 */

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
  action?: string
  timeout?: number // 超时时间（毫秒），默认 30000
  target?: 'all' | 'first' | 'specific' // 通知策略
  clientId?: string // specific 模式下指定的客户端 ID
}

/**
 * 工具 Handler 类型（第一阶段只支持 websocket）
 */
export type ToolHandler = WebSocketHandler

/**
 * 工具定义
 */
export interface Tool {
  name: string
  description: string
  inputSchema: InputSchema
  handler: ToolHandler
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
  handler: ToolHandler
}

/**
 * 更新工具请求
 */
export interface UpdateToolRequest {
  description?: string
  inputSchema?: InputSchema
  handler?: ToolHandler
}

// ==================== MCP 配置 ====================

/**
 * MCP 配置（供前端复制到 Claude Desktop）
 */
export interface MCPConfig {
  serverName: string
  serverUrl: string
  sseEndpoint: string
  claudeConfig: {
    mcpServers: {
      [key: string]: {
        url: string
      }
    }
  }
  tools: string[]
  createdAt: string
}

// ==================== WebSocket 消息 ====================

/**
 * WebSocket 消息基础接口
 */
export interface WSMessage {
  type: string
}

/**
 * 注册消息
 */
export interface WSRegisterMessage extends WSMessage {
  type: 'register'
  clientId?: string
  capabilities?: string[]
}

/**
 * 心跳请求
 */
export interface WSPingMessage extends WSMessage {
  type: 'ping'
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
  | 'tool_updated'

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
  timeout: ReturnType<typeof setTimeout>
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