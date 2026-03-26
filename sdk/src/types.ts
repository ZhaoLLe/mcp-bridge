/**
 * MCP Bridge SDK 类型定义
 */

/**
 * 事件类型
 */
export type EventType =
  | 'tool_invoked'
  | 'tool_registered'
  | 'tool_deleted'
  | 'tool_updated'

/**
 * 错误码
 */
export type ErrorCode =
  | 'INVALID_MESSAGE'
  | 'UNKNOWN_MESSAGE_TYPE'
  | 'NOT_REGISTERED'
  | 'CLIENT_OFFLINE'
  | 'TIMEOUT'
  | 'EXECUTION_FAILED'
  | 'REJECTED'
  | 'UNKNOWN_TOOL'
  | 'DUPLICATE_TOOL'

/**
 * JSON Schema 类型
 */
export type JSONSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null'

/**
 * JSON Schema 属性定义
 */
export interface JSONSchemaProperty {
  type: JSONSchemaType | JSONSchemaType[]
  description?: string
  items?: JSONSchemaProperty
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  enum?: (string | number | boolean)[]
  default?: unknown
}

/**
 * 工具输入 Schema
 */
export interface ToolInputSchema {
  type: 'object'
  properties: Record<string, JSONSchemaProperty>
  required?: string[]
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具名称 */
  name: string
  /** 工具描述 */
  description: string
  /** 参数 Schema */
  inputSchema: ToolInputSchema
  /** 超时时间（毫秒），默认 30000 */
  timeout?: number
}

/**
 * 简化的参数定义
 */
export interface SimpleParam {
  /** 参数名 */
  name: string
  /** 参数描述 */
  description?: string
  /** 参数类型，默认 string */
  type?: JSONSchemaType
  /** 是否必填，默认 true */
  required?: boolean
}

/**
 * 连接选项
 */
export interface ConnectOptions {
  /** 客户端 ID（可选，不填则由服务端生成） */
  clientId?: string
  /** 能力列表（可执行的工具名称） */
  capabilities?: string[]
  /** 心跳间隔（毫秒），默认 25000 */
  heartbeatInterval?: number
  /** 自动重连，默认 false */
  autoReconnect?: boolean
  /** 重连延迟（毫秒），默认 3000 */
  reconnectDelay?: number
}

/**
 * 工具执行请求
 */
export interface ToolRequest {
  /** 请求 ID */
  requestId: string
  /** 工具名称 */
  tool: string
  /** 动作标识 */
  action?: string
  /** 参数 */
  arguments: Record<string, unknown>
  /** 超时时间（毫秒） */
  timeout: number
  /** 时间戳 */
  timestamp: string
}

/**
 * 事件负载
 */
export interface EventPayload {
  /** 事件类型 */
  type: EventType
  /** 时间戳 */
  timestamp: string
  /** 数据 */
  data: unknown
}

/**
 * 错误响应
 */
export interface ErrorResponse {
  /** 错误码 */
  code: ErrorCode
  /** 错误消息 */
  message: string
}

/**
 * SDK 事件类型映射
 */
export interface SDKEventMap {
  connected: { clientId: string }
  disconnected: { reason?: string }
  tool_request: ToolRequest
  tool_invoked: EventPayload
  tool_registered: EventPayload
  tool_deleted: EventPayload
  tool_updated: EventPayload
  error: ErrorResponse
}

/**
 * 事件回调类型
 */
export type EventCallback<K extends keyof SDKEventMap> = (data: SDKEventMap[K]) => void