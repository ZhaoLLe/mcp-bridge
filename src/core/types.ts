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
 * Skill Handler 配置
 */
export interface SkillHandler {
  type: 'skill'
  skillName: string
}

/**
 * HTTP Handler 配置
 */
export interface HttpHandler {
  type: 'http'
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  timeout?: number // 超时时间（毫秒），默认 30000
}

/**
 * 工具 Handler 类型
 */
export type ToolHandler = WebSocketHandler | SkillHandler | HttpHandler

/**
 * 工具定义
 */
export interface Tool {
  name: string
  description: string
  inputSchema: InputSchema
  handler: ToolHandler
  status: 'enabled' | 'disabled'
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
  | 'skill_invoked'
  | 'skill_registered'
  | 'skill_updated'
  | 'skill_deleted'

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

// ==================== Skill 相关 ====================

/**
 * Skill 节点类型
 */
export type SkillNodeType = 'start' | 'end' | 'tool' | 'condition'

/**
 * Skill 节点配置
 */
export interface SkillNodeConfig {
  // Start 节点
  inputSchema?: InputSchema
  // Tool 节点
  toolName?: string
  inputMapping?: Record<string, string>
  // Condition 节点
  condition?: string
  // End 节点
  outputMapping?: Record<string, string>
}

/**
 * Skill 节点
 */
export interface SkillNode {
  id: string
  type: SkillNodeType
  name: string
  config: SkillNodeConfig
  position: { x: number; y: number }
}

/**
 * Skill 边
 */
export interface SkillEdge {
  id: string
  source: string
  target: string
  label?: 'true' | 'false' | string
}

/**
 * Skill 暴露模式
 */
export interface SkillExposeModes {
  asSkill: boolean    // 生成 SKILL.md
  asTool: boolean     // 注册为 MCP Tool
  asPrompt: boolean   // 生成 Prompt 模板
}

/**
 * Skill 定义
 */
export interface Skill {
  id: string
  name: string                        // snake_case，唯一
  displayName: string                 // 显示名称
  description: string                 // 描述

  // 触发配置
  triggerPhrases: string[]            // 触发短语列表

  // 暴露模式
  exposeModes: SkillExposeModes

  status: 'enabled' | 'disabled'
  inputSchema: InputSchema
  outputSchema?: InputSchema
  nodes: SkillNode[]
  edges: SkillEdge[]

  createdAt: number
  updatedAt: number
}

/**
 * 创建 Skill 请求
 */
export interface CreateSkillRequest {
  name: string
  displayName: string
  description: string
  triggerPhrases?: string[]
  exposeModes?: Partial<SkillExposeModes>
  inputSchema: InputSchema
  outputSchema?: InputSchema
  nodes: SkillNode[]
  edges: SkillEdge[]
}

/**
 * 更新 Skill 请求
 */
export interface UpdateSkillRequest {
  displayName?: string
  description?: string
  triggerPhrases?: string[]
  exposeModes?: Partial<SkillExposeModes>
  inputSchema?: InputSchema
  outputSchema?: InputSchema
  nodes?: SkillNode[]
  edges?: SkillEdge[]
}

/**
 * Skill 列表响应
 */
export interface SkillListResponse {
  skills: Skill[]
  total: number
}

/**
 * Skill 执行上下文
 */
export interface SkillExecutionContext {
  skillId: string
  skillName: string
  input: Record<string, unknown>
  nodeOutputs: Map<string, unknown>
  currentNodeId: string | null
  startTime: number
}

/**
 * 节点执行结果
 */
export interface NodeExecutionResult {
  nodeId: string
  nodeName: string
  nodeType: SkillNodeType
  input?: Record<string, unknown>
  output?: unknown
  error?: {
    code: string
    message: string
  }
  status: 'success' | 'failed' | 'skipped'
  duration: number
}

/**
 * Skill 执行结果
 */
export interface SkillExecutionResult {
  skillId: string
  skillName: string
  input: Record<string, unknown>
  output?: unknown
  error?: {
    code: string
    message: string
    nodeId?: string
  }
  status: 'success' | 'failed' | 'timeout'
  duration: number
  nodeExecutions: NodeExecutionResult[]
}

// ==================== 调用日志 ====================

/**
 * 调用日志
 */
export interface InvokeLog {
  id: string
  type: 'tool' | 'skill'
  name: string
  skillId?: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: { code: string; message: string }
  status: 'success' | 'failed' | 'timeout'
  duration: number
  timestamp: number
  subCalls?: InvokeLog[]
}

/**
 * 调用日志查询选项
 */
export interface LogQueryOptions {
  type?: 'tool' | 'skill'
  name?: string
  status?: 'success' | 'failed' | 'timeout'
  startTime?: number
  endTime?: number
  page?: number
  pageSize?: number
}

/**
 * 调用日志列表响应
 */
export interface InvokeLogListResponse {
  logs: InvokeLog[]
  total: number
}