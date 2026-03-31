/**
 * API 客户端服务
 * 封装所有与后端的 HTTP 通信
 */

const API_BASE = '/api'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

// ==================== Tool 相关类型 ====================

export interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
      enum?: string[]
      default?: unknown
    }>
    required?: string[]
  }
  outputSchema?: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
    }>
  }
  handler: {
    type: 'websocket' | 'skill' | 'http'
    action?: string
    timeout?: number
    target?: 'all' | 'first' | 'specific'
    clientId?: string
    skillName?: string
    url?: string
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    headers?: Record<string, string>
  }
  status: 'enabled' | 'disabled'
  createdAt: number
  updatedAt: number
}

export interface CreateToolRequest {
  name: string
  description: string
  inputSchema: Tool['inputSchema']
  handler: Tool['handler']
}

export interface UpdateToolRequest {
  description?: string
  inputSchema?: Tool['inputSchema']
  handler?: Tool['handler']
}

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
}

// ==================== Skill 相关类型 ====================

export type SkillNodeType = 'start' | 'end' | 'tool' | 'condition'

export interface SkillNodeConfig {
  inputSchema?: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
    }>
    required?: string[]
  }
  toolName?: string
  inputMapping?: Record<string, string>
  condition?: string
  outputMapping?: Record<string, string>
}

export interface SkillNode {
  id: string
  type: SkillNodeType
  name: string
  config: SkillNodeConfig
  position: { x: number; y: number }
}

export interface SkillEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface Skill {
  id: string
  name: string
  displayName: string
  description: string
  triggerPhrases: string[]
  exposeModes: {
    asSkill: boolean
    asTool: boolean
    asPrompt: boolean
  }
  status: 'enabled' | 'disabled'
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
    }>
    required?: string[]
  }
  outputSchema?: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
    }>
    required?: string[]
  }
  nodes: SkillNode[]
  edges: SkillEdge[]
  createdAt: number
  updatedAt: number
}

export interface CreateSkillRequest {
  name: string
  displayName: string
  description: string
  triggerPhrases?: string[]
  exposeModes?: {
    asSkill?: boolean
    asTool?: boolean
    asPrompt?: boolean
  }
  inputSchema: Skill['inputSchema']
  outputSchema?: Skill['outputSchema']
  nodes: SkillNode[]
  edges: SkillEdge[]
}

export interface UpdateSkillRequest {
  displayName?: string
  description?: string
  triggerPhrases?: string[]
  exposeModes?: {
    asSkill?: boolean
    asTool?: boolean
    asPrompt?: boolean
  }
  inputSchema?: Skill['inputSchema']
  outputSchema?: Skill['outputSchema']
  nodes?: SkillNode[]
  edges?: SkillEdge[]
}

// ==================== Log 相关类型 ====================

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

export interface LogQueryOptions {
  type?: 'tool' | 'skill'
  name?: string
  status?: 'success' | 'failed' | 'timeout'
  startTime?: number
  endTime?: number
  page?: number
  pageSize?: number
}

export interface LogStats {
  total: number
  successCount: number
  failedCount: number
  timeoutCount: number
  toolCount: number
  skillCount: number
  avgDuration: number
  last24HoursCount: number
  successRate: number
}

// ==================== API 客户端类 ====================

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })
    const data: ApiResponse<T> = await response.json()
    if (!data.success) {
      throw new Error(data.error?.message || 'Request failed')
    }
    return data.data!
  }

  // ==================== Tools API ====================

  async getTools(): Promise<Tool[]> {
    const data = await this.request<{ tools: Tool[]; total: number }>('/tools')
    return data.tools
  }

  async getTool(name: string): Promise<Tool> {
    return await this.request<Tool>(`/tools/${encodeURIComponent(name)}`)
  }

  async createTool(tool: CreateToolRequest): Promise<{ tool: Tool; mcpConfig: MCPConfig }> {
    return await this.request('/tools', {
      method: 'POST',
      body: JSON.stringify(tool),
    })
  }

  async updateTool(name: string, updates: UpdateToolRequest): Promise<Tool> {
    return await this.request(`/tools/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteTool(name: string): Promise<void> {
    await this.request(`/tools/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  }

  async invokeTool(name: string, args: Record<string, unknown>): Promise<{
    tool: string
    arguments: Record<string, unknown>
    result?: unknown
    error?: { code: string; message: string }
    duration: number
  }> {
    return await this.request(`/tools/${encodeURIComponent(name)}/invoke`, {
      method: 'POST',
      body: JSON.stringify(args),
    })
  }

  async getMCPConfig(): Promise<MCPConfig> {
    return await this.request('/tools/mcp-config')
  }

  async toggleToolStatus(name: string): Promise<Tool> {
    return await this.request(`/tools/${encodeURIComponent(name)}/toggle`, {
      method: 'POST',
    })
  }

  // ==================== Skills API ====================

  async getSkills(options?: {
    page?: number
    pageSize?: number
    status?: 'enabled' | 'disabled'
    search?: string
  }): Promise<{ skills: Skill[]; total: number }> {
    const params = new URLSearchParams()
    if (options?.page) params.append('page', String(options.page))
    if (options?.pageSize) params.append('pageSize', String(options.pageSize))
    if (options?.status) params.append('status', options.status)
    if (options?.search) params.append('search', options.search)
    const query = params.toString() ? `?${params.toString()}` : ''
    return await this.request(`/skills${query}`)
  }

  async getSkill(name: string): Promise<Skill> {
    return await this.request(`/skills/${encodeURIComponent(name)}`)
  }

  async getSkillById(id: string): Promise<Skill> {
    return await this.request(`/skills/id/${encodeURIComponent(id)}`)
  }

  async createSkill(skill: CreateSkillRequest): Promise<Skill> {
    return await this.request('/skills', {
      method: 'POST',
      body: JSON.stringify(skill),
    })
  }

  async updateSkill(name: string, updates: UpdateSkillRequest): Promise<Skill> {
    return await this.request(`/skills/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteSkill(name: string): Promise<void> {
    await this.request(`/skills/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  }

  async toggleSkillStatus(name: string): Promise<Skill> {
    return await this.request(`/skills/${encodeURIComponent(name)}/toggle`, {
      method: 'POST',
    })
  }

  async updateTriggerPhrases(name: string, phrases: string[]): Promise<Skill> {
    return await this.request(`/skills/${encodeURIComponent(name)}/trigger-phrases`, {
      method: 'PUT',
      body: JSON.stringify({ phrases }),
    })
  }

  async updateExposeModes(name: string, modes: {
    asSkill?: boolean
    asTool?: boolean
    asPrompt?: boolean
  }): Promise<Skill> {
    return await this.request(`/skills/${encodeURIComponent(name)}/expose-modes`, {
      method: 'PUT',
      body: JSON.stringify(modes),
    })
  }

  async getSkillMd(name: string): Promise<string> {
    const response = await fetch(`/api/skills/${encodeURIComponent(name)}/skill-md`)
    if (!response.ok) {
      throw new Error('Failed to fetch SKILL.md')
    }
    return await response.text()
  }

  async downloadSkillMd(name: string): Promise<Blob> {
    const response = await fetch(`/api/skills/${encodeURIComponent(name)}/skill-md/download`)
    if (!response.ok) {
      throw new Error('Failed to download SKILL.md')
    }
    return await response.blob()
  }

  async getPromptTemplate(name: string): Promise<string> {
    const response = await fetch(`/api/skills/${encodeURIComponent(name)}/prompt-template`)
    if (!response.ok) {
      throw new Error('Failed to fetch prompt template')
    }
    return await response.text()
  }

  async downloadPromptTemplate(name: string): Promise<Blob> {
    const response = await fetch(`/api/skills/${encodeURIComponent(name)}/prompt-template/download`)
    if (!response.ok) {
      throw new Error('Failed to download prompt template')
    }
    return await response.blob()
  }

  async invokeSkill(name: string, args: Record<string, unknown>): Promise<{
    skillId: string
    skillName: string
    input: Record<string, unknown>
    output?: unknown
    error?: { code: string; message: string; nodeId?: string }
    status: 'success' | 'failed' | 'timeout'
    duration: number
    nodeExecutions: unknown[]
  }> {
    return await this.request(`/skills/${encodeURIComponent(name)}/invoke`, {
      method: 'POST',
      body: JSON.stringify(args),
    })
  }

  async getSkillsUsingTool(toolName: string): Promise<{ skills: Skill[]; total: number }> {
    return await this.request(`/skills/references/tool/${encodeURIComponent(toolName)}`)
  }

  async getAllReferencedTools(): Promise<string[]> {
    return await this.request('/skills/references/all-tools')
  }

  // ==================== Logs API ====================

  async getLogs(options?: LogQueryOptions): Promise<{ logs: InvokeLog[]; total: number }> {
    const params = new URLSearchParams()
    if (options?.type) params.append('type', options.type)
    if (options?.name) params.append('name', options.name)
    if (options?.status) params.append('status', options.status)
    if (options?.startTime) params.append('startTime', String(options.startTime))
    if (options?.endTime) params.append('endTime', String(options.endTime))
    if (options?.page) params.append('page', String(options.page))
    if (options?.pageSize) params.append('pageSize', String(options.pageSize))
    const query = params.toString() ? `?${params.toString()}` : ''
    return await this.request(`/logs${query}`)
  }

  async getLog(id: string): Promise<InvokeLog> {
    return await this.request(`/logs/${encodeURIComponent(id)}`)
  }

  async clearLogs(): Promise<void> {
    await this.request('/logs/clear', {
      method: 'DELETE',
    })
  }

  async getLogStats(): Promise<LogStats> {
    return await this.request('/logs/stats/summary')
  }

  async getLogHistory(name: string, limit?: number): Promise<{ logs: InvokeLog[]; total: number }> {
    const params = limit ? `?limit=${limit}` : ''
    return await this.request(`/logs/history/${encodeURIComponent(name)}${params}`)
  }
}

// 导出单例
export const apiClient = new ApiClient()
