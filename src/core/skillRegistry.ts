/**
 * Skill 注册中心
 * 管理 Skill 的 CRUD、状态控制、引用关系
 */

import type {
  Skill,
  CreateSkillRequest,
  UpdateSkillRequest,
  SkillListResponse,
} from './types'

/**
 * Skill 注册表错误码
 */
export type SkillRegistryErrorCode =
  | 'DUPLICATE_SKILL'
  | 'SKILL_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INVALID_NODE_REFERENCE'
  | 'INVALID_EDGE_REFERENCE'

/**
 * Skill 注册表错误
 */
export class SkillRegistryError extends Error {
  constructor(
    public code: SkillRegistryErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'SkillRegistryError'
  }
}

/**
 * Skill 注册表配置
 */
export interface SkillRegistryConfig {
  /** 最大 Skill 数量，默认 100 */
  maxSkills?: number
}

/**
 * Skill 注册表
 */
export class SkillRegistry {
  private skills: Map<string, Skill> = new Map()
  private maxSkills: number

  constructor(config: SkillRegistryConfig = {}) {
    this.maxSkills = config.maxSkills ?? 100
  }

  /**
   * 注册 Skill
   */
  register(request: CreateSkillRequest): Skill {
    // 验证名称格式
    this.validateName(request.name)

    // 检查是否已存在
    if (this.skills.has(request.name)) {
      throw new SkillRegistryError(
        'DUPLICATE_SKILL',
        `Skill "${request.name}" already exists`
      )
    }

    // 检查数量限制
    if (this.skills.size >= this.maxSkills) {
      throw new SkillRegistryError(
        'VALIDATION_ERROR',
        `Maximum skill count (${this.maxSkills}) reached`
      )
    }

    // 验证节点和边
    this.validateNodes(request.nodes)
    this.validateEdges(request.nodes, request.edges)

    const now = Date.now()
    const skill: Skill = {
      id: this.generateId(),
      name: request.name,
      displayName: request.displayName,
      description: request.description,
      triggerPhrases: request.triggerPhrases ?? [],
      exposeModes: {
        asSkill: request.exposeModes?.asSkill ?? true,
        asTool: request.exposeModes?.asTool ?? false,
        asPrompt: request.exposeModes?.asPrompt ?? false,
      },
      status: 'enabled',
      inputSchema: request.inputSchema,
      outputSchema: request.outputSchema,
      nodes: request.nodes,
      edges: request.edges,
      createdAt: now,
      updatedAt: now,
    }

    this.skills.set(skill.name, skill)
    return skill
  }

  /**
   * 获取 Skill
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  /**
   * 获取 Skill by ID
   */
  getById(id: string): Skill | undefined {
    for (const skill of this.skills.values()) {
      if (skill.id === id) {
        return skill
      }
    }
    return undefined
  }

  /**
   * 获取所有 Skill
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values())
  }

  /**
   * 获取 Skill 列表（分页）
   */
  list(options: {
    page?: number
    pageSize?: number
    status?: 'enabled' | 'disabled'
    search?: string
  } = {}): SkillListResponse {
    let skills = this.getAll()

    // 状态筛选
    if (options.status) {
      skills = skills.filter(s => s.status === options.status)
    }

    // 搜索
    if (options.search) {
      const search = options.search.toLowerCase()
      skills = skills.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.displayName.toLowerCase().includes(search) ||
        s.description.toLowerCase().includes(search)
      )
    }

    // 排序（按创建时间倒序）
    skills.sort((a, b) => b.createdAt - a.createdAt)

    const total = skills.length

    // 分页
    const page = options.page ?? 1
    const pageSize = options.pageSize ?? 20
    const start = (page - 1) * pageSize
    const end = start + pageSize
    skills = skills.slice(start, end)

    return { skills, total }
  }

  /**
   * 更新 Skill
   */
  update(name: string, request: UpdateSkillRequest): Skill {
    const skill = this.skills.get(name)
    if (!skill) {
      throw new SkillRegistryError(
        'SKILL_NOT_FOUND',
        `Skill "${name}" not found`
      )
    }

    // 验证节点和边（如果提供）
    if (request.nodes) {
      this.validateNodes(request.nodes)
    }
    if (request.nodes && request.edges) {
      this.validateEdges(request.nodes, request.edges)
    } else if (request.edges) {
      this.validateEdges(skill.nodes, request.edges)
    }

    // 合并更新
    const updatedSkill: Skill = {
      ...skill,
      displayName: request.displayName ?? skill.displayName,
      description: request.description ?? skill.description,
      triggerPhrases: request.triggerPhrases ?? skill.triggerPhrases,
      exposeModes: {
        ...skill.exposeModes,
        ...(request.exposeModes ?? {}),
      },
      inputSchema: request.inputSchema ?? skill.inputSchema,
      outputSchema: request.outputSchema ?? skill.outputSchema,
      nodes: request.nodes ?? skill.nodes,
      edges: request.edges ?? skill.edges,
      updatedAt: Date.now(),
    }

    this.skills.set(name, updatedSkill)
    return updatedSkill
  }

  /**
   * 删除 Skill
   */
  delete(name: string): boolean {
    return this.skills.delete(name)
  }

  /**
   * 检查 Skill 是否存在
   */
  has(name: string): boolean {
    return this.skills.has(name)
  }

  /**
   * 获取 Skill 数量
   */
  get count(): number {
    return this.skills.size
  }

  /**
   * 切换 Skill 状态
   */
  toggleStatus(name: string): Skill {
    const skill = this.skills.get(name)
    if (!skill) {
      throw new SkillRegistryError(
        'SKILL_NOT_FOUND',
        `Skill "${name}" not found`
      )
    }

    skill.status = skill.status === 'enabled' ? 'disabled' : 'enabled'
    skill.updatedAt = Date.now()
    return skill
  }

  /**
   * 更新触发短语
   */
  updateTriggerPhrases(name: string, phrases: string[]): Skill {
    const skill = this.skills.get(name)
    if (!skill) {
      throw new SkillRegistryError(
        'SKILL_NOT_FOUND',
        `Skill "${name}" not found`
      )
    }

    skill.triggerPhrases = phrases
    skill.updatedAt = Date.now()
    return skill
  }

  /**
   * 更新暴露模式
   */
  updateExposeModes(name: string, modes: Partial<Skill['exposeModes']>): Skill {
    const skill = this.skills.get(name)
    if (!skill) {
      throw new SkillRegistryError(
        'SKILL_NOT_FOUND',
        `Skill "${name}" not found`
      )
    }

    skill.exposeModes = { ...skill.exposeModes, ...modes }
    skill.updatedAt = Date.now()
    return skill
  }

  /**
   * 获取引用了指定工具的 Skill 列表
   */
  getSkillsUsingTool(toolName: string): Skill[] {
    const skills: Skill[] = []
    for (const skill of this.skills.values()) {
      const usesTool = skill.nodes.some(
        node => node.type === 'tool' && node.config.toolName === toolName
      )
      if (usesTool) {
        skills.push(skill)
      }
    }
    return skills
  }

  /**
   * 获取所有被 Skill 引用的工具名称
   */
  getReferencedTools(): Set<string> {
    const tools = new Set<string>()
    for (const skill of this.skills.values()) {
      for (const node of skill.nodes) {
        if (node.type === 'tool' && node.config.toolName) {
          tools.add(node.config.toolName)
        }
      }
    }
    return tools
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `skill_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  /**
   * 验证 Skill 名称格式
   */
  private validateName(name: string): void {
    // 必须是 snake_case，以小写字母开头
    const nameRegex = /^[a-z][a-z0-9_]*$/
    if (!nameRegex.test(name)) {
      throw new SkillRegistryError(
        'VALIDATION_ERROR',
        'Skill name must be snake_case, starting with a lowercase letter'
      )
    }

    if (name.length > 64) {
      throw new SkillRegistryError(
        'VALIDATION_ERROR',
        'Skill name must be at most 64 characters'
      )
    }
  }

  /**
   * 验证节点配置
   */
  private validateNodes(nodes: Skill['nodes']): void {
    const nodeIds = new Set<string>()

    // 检查必须有且仅有一个 start 节点
    const startNodes = nodes.filter(n => n.type === 'start')
    if (startNodes.length === 0) {
      throw new SkillRegistryError(
        'VALIDATION_ERROR',
        'Skill must have exactly one start node'
      )
    }
    if (startNodes.length > 1) {
      throw new SkillRegistryError(
        'VALIDATION_ERROR',
        'Skill must have exactly one start node, found multiple'
      )
    }

    // 检查必须有且仅有一个 end 节点
    const endNodes = nodes.filter(n => n.type === 'end')
    if (endNodes.length === 0) {
      throw new SkillRegistryError(
        'VALIDATION_ERROR',
        'Skill must have exactly one end node'
      )
    }
    if (endNodes.length > 1) {
      throw new SkillRegistryError(
        'VALIDATION_ERROR',
        'Skill must have exactly one end node, found multiple'
      )
    }

    // 验证每个节点
    for (const node of nodes) {
      // ID 唯一性
      if (nodeIds.has(node.id)) {
        throw new SkillRegistryError(
          'INVALID_NODE_REFERENCE',
          `Duplicate node ID: ${node.id}`
        )
      }
      nodeIds.add(node.id)

      // Tool 节点必须有 toolName
      if (node.type === 'tool' && !node.config.toolName) {
        throw new SkillRegistryError(
          'VALIDATION_ERROR',
          `Tool node "${node.id}" must have a toolName`
        )
      }

      // Condition 节点必须有 condition
      if (node.type === 'condition' && !node.config.condition) {
        throw new SkillRegistryError(
          'VALIDATION_ERROR',
          `Condition node "${node.id}" must have a condition`
        )
      }
    }
  }

  /**
   * 验证边配置
   */
  private validateEdges(nodes: Skill['nodes'], edges: Skill['edges']): void {
    const nodeIds = new Set(nodes.map(n => n.id))

    for (const edge of edges) {
      // source 必须存在
      if (!nodeIds.has(edge.source)) {
        throw new SkillRegistryError(
          'INVALID_EDGE_REFERENCE',
          `Edge source node "${edge.source}" not found`
        )
      }

      // target 必须存在
      if (!nodeIds.has(edge.target)) {
        throw new SkillRegistryError(
          'INVALID_EDGE_REFERENCE',
          `Edge target node "${edge.target}" not found`
        )
      }

      // 不能连接到自己
      if (edge.source === edge.target) {
        throw new SkillRegistryError(
          'INVALID_EDGE_REFERENCE',
          `Edge cannot connect node to itself: ${edge.source}`
        )
      }
    }
  }
}