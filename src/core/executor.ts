/**
 * 工具执行器
 * 处理工具执行逻辑，包括 WebSocket、Skill 和 HTTP handler 类型
 */

import type { Tool, PendingRequest, ErrorCode, WSToolRequestMessage, WSClient } from './types'
import { ToolRegistry } from './registry'
import { randomUUID } from 'crypto'

/**
 * HTTP 响应接口
 */
interface HttpResponse {
  data: unknown
  status: number
  headers: Record<string, string>
}

/**
 * WebSocket 客户端管理器接口（依赖倒置）
 */
export interface IWSClientManager {
  getClientsWithCapability(capability: string): WSClient[]
}

/**
 * Skill 执行器接口（依赖倒置，避免循环依赖）
 */
export interface ISkillExecutor {
  execute(skillName: string, args: Record<string, unknown>): Promise<{
    skillId: string
    skillName: string
    input: Record<string, unknown>
    output?: unknown
    error?: { code: string; message: string; nodeId?: string }
    status: 'success' | 'failed' | 'timeout'
    duration: number
    nodeExecutions: unknown[]
  }>
}

export class ToolExecutor {
  private pendingRequests: Map<string, PendingRequest> = new Map()

  constructor(
    private registry: ToolRegistry,
    private clientManager: IWSClientManager,
    private skillExecutor?: ISkillExecutor
  ) {}

  /**
   * 设置 Skill 执行器（用于延迟注入）
   */
  setSkillExecutor(executor: ISkillExecutor): void {
    this.skillExecutor = executor
  }

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

    if (handler.type === 'skill') {
      return this.executeSkill(handler.skillName, args)
    }

    if (handler.type === 'http') {
      return this.executeHttp(handler, args)
    }

    return {
      success: false,
      error: { code: 'EXECUTION_FAILED', message: `Unknown handler type: ${(handler as { type: string }).type}` }
    }
  }

  /**
   * Skill Handler 执行
   */
  private async executeSkill(
    skillName: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: { code: ErrorCode; message: string } }> {
    if (!this.skillExecutor) {
      return {
        success: false,
        error: { code: 'EXECUTION_FAILED', message: 'Skill executor not configured' }
      }
    }

    try {
      const result = await this.skillExecutor.execute(skillName, args)

      if (result.status === 'success') {
        return {
          success: true,
          result: result.output
        }
      } else {
        return {
          success: false,
          error: {
            code: 'EXECUTION_FAILED',
            message: result.error?.message || `Skill '${skillName}' execution failed`
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: { code: 'EXECUTION_FAILED', message: String(error) }
      }
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
    if (handler.type !== 'websocket') {
      return {
        success: false,
        error: { code: 'EXECUTION_FAILED', message: 'Invalid handler type' }
      }
    }

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
    } else if (handler.target === 'specific' && handler.clientId) {
      const specificClient = clients.find(c => c.id === handler.clientId)
      if (specificClient) {
        targetClients = [specificClient]
      } else {
        return {
          success: false,
          error: { code: 'CLIENT_OFFLINE', message: `Client '${handler.clientId}' not found or not capable` }
        }
      }
    } else {
      targetClients = clients // 'all' 或默认
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
  handleResponse(message: { requestId: string; success: boolean; result?: unknown; error?: { message: string } }): void {
    console.log('[DEBUG] handleResponse called, requestId:', message.requestId)
    console.log('[DEBUG] pendingRequests keys:', Array.from(this.pendingRequests.keys()))
    const pending = this.pendingRequests.get(message.requestId)
    if (!pending) {
      // 可能已超时或不存在
      console.log('[DEBUG] No pending request found for requestId')
      return
    }

    console.log('[DEBUG] Found pending request, resolving...')
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

  /**
   * 获取所有待处理请求
   */
  getPendingRequests(): PendingRequest[] {
    return Array.from(this.pendingRequests.values())
  }

  /**
   * HTTP Handler 执行
   */
  private async executeHttp(
    handler: { type: 'http'; url: string; method: string; headers?: Record<string, string>; timeout?: number },
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: { code: ErrorCode; message: string } }> {
    const timeout = handler.timeout ?? 30000

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(handler.url, {
        method: handler.method,
        headers: {
          'Content-Type': 'application/json',
          ...handler.headers
        },
        body: handler.method !== 'GET' && handler.method !== 'DELETE' ? JSON.stringify(args) : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (response.ok) {
        return {
          success: true,
          result: data
        }
      } else {
        return {
          success: false,
          error: {
            code: 'HTTP_ERROR',
            message: data.message || data.error || `HTTP ${response.status}: ${response.statusText}`
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: { code: 'TIMEOUT', message: `HTTP request timed out after ${timeout}ms` }
          }
        }
        return {
          success: false,
          error: { code: 'HTTP_ERROR', message: error.message }
        }
      }
      return {
        success: false,
        error: { code: 'HTTP_ERROR', message: String(error) }
      }
    }
  }
}