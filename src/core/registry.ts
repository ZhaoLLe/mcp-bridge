/**
 * 工具注册中心
 * 使用内存 Map 存储工具定义
 */

import type { Tool, CreateToolRequest, UpdateToolRequest, MCPConfig } from './types'

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