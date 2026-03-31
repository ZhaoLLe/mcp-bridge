/**
 * 工具注册中心
 * 使用内存 Map 存储工具定义
 */

import type { Tool, CreateToolRequest, UpdateToolRequest, MCPConfig, ToolListResponse } from './types'

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
      status: 'enabled',
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
   * 获取工具列表（分页）
   */
  list(options: {
    page?: number
    pageSize?: number
    status?: 'enabled' | 'disabled'
    search?: string
  } = {}): ToolListResponse {
    let tools = this.getAll()

    // 状态筛选
    if (options.status) {
      tools = tools.filter(t => t.status === options.status)
    }

    // 搜索
    if (options.search) {
      const search = options.search.toLowerCase()
      tools = tools.filter(t =>
        t.name.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      )
    }

    // 排序（按创建时间倒序）
    tools.sort((a, b) => b.createdAt - a.createdAt)

    const total = tools.length

    // 分页
    const page = options.page ?? 1
    const pageSize = options.pageSize ?? 20
    const start = (page - 1) * pageSize
    const end = start + pageSize
    tools = tools.slice(start, end)

    return { tools, total }
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
   * 切换工具状态
   */
  toggleStatus(name: string): Tool {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Tool '${name}' not found`)
    }

    tool.status = tool.status === 'enabled' ? 'disabled' : 'enabled'
    tool.updatedAt = Date.now()
    return tool
  }

  /**
   * 生成 MCP 配置（供前端复制到 Claude）
   */
  generateMCPConfig(): MCPConfig {
    const sseEndpoint = `${this.serverUrl}/sse`

    // 只返回启用的工具
    const enabledTools = this.getAll()
      .filter(t => t.status === 'enabled')
      .map(t => t.name)

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
      tools: enabledTools,
      createdAt: new Date().toISOString()
    }
  }
}