/**
 * Skill 执行引擎
 * 负责执行 Skill 流程，包括节点遍历、工具调用、条件判断等
 */

import type {
  Skill,
  SkillNode,
  SkillExecutionResult,
  NodeExecutionResult,
  SkillExecutionContext,
} from './types'
import { SkillRegistry } from './skillRegistry'
import { ToolExecutor } from './executor'

/**
 * 执行错误码
 */
export type SkillExecutorErrorCode =
  | 'SKILL_NOT_FOUND'
  | 'SKILL_DISABLED'
  | 'TOOL_NOT_FOUND'
  | 'TOOL_EXECUTION_FAILED'
  | 'CONDITION_EVALUATION_FAILED'
  | 'INVALID_EXPRESSION'
  | 'CYCLE_DETECTED'
  | 'TIMEOUT'
  | 'UNKNOWN_NODE_TYPE'

/**
 * 执行错误
 */
export class SkillExecutorError extends Error {
  constructor(
    public code: SkillExecutorErrorCode,
    message: string,
    public nodeId?: string
  ) {
    super(message)
    this.name = 'SkillExecutorError'
  }
}

/**
 * Skill 执行器配置
 */
export interface SkillExecutorConfig {
  /** 默认超时时间（毫秒），默认 60000 */
  defaultTimeout?: number
  /** 最大执行步骤数，防止死循环，默认 100 */
  maxSteps?: number
}

/**
 * Skill 执行器
 */
export class SkillExecutor {
  private defaultTimeout: number
  private maxSteps: number

  constructor(
    private skillRegistry: SkillRegistry,
    private toolExecutor: ToolExecutor,
    private config: SkillExecutorConfig = {}
  ) {
    this.defaultTimeout = config.defaultTimeout ?? 60000
    this.maxSteps = config.maxSteps ?? 100
  }

  /**
   * 执行 Skill
   */
  async execute(skillName: string, input: Record<string, unknown>): Promise<SkillExecutionResult> {
    const startTime = Date.now()
    const nodeExecutions: NodeExecutionResult[] = []

    // 获取 Skill
    const skill = this.skillRegistry.get(skillName)
    if (!skill) {
      return {
        skillId: '',
        skillName,
        input,
        error: { code: 'SKILL_NOT_FOUND', message: `Skill "${skillName}" not found` },
        status: 'failed',
        duration: Date.now() - startTime,
        nodeExecutions,
      }
    }

    if (skill.status === 'disabled') {
      return {
        skillId: skill.id,
        skillName,
        input,
        error: { code: 'SKILL_DISABLED', message: `Skill "${skillName}" is disabled` },
        status: 'failed',
        duration: Date.now() - startTime,
        nodeExecutions,
      }
    }

    // 构建边映射
    const edgeMap = this.buildEdgeMap(skill)

    // 找到 start 节点
    const startNode = skill.nodes.find(n => n.type === 'start')
    if (!startNode) {
      return {
        skillId: skill.id,
        skillName,
        input,
        error: { code: 'UNKNOWN_NODE_TYPE', message: 'No start node found' },
        status: 'failed',
        duration: Date.now() - startTime,
        nodeExecutions,
      }
    }

    // 初始化执行上下文
    const context: SkillExecutionContext = {
      skillId: skill.id,
      skillName: skill.name,
      input,
      nodeOutputs: new Map(),
      currentNodeId: startNode.id,
      startTime,
    }

    // 存储输入到 start 节点输出
    context.nodeOutputs.set(startNode.id, input)

    // 记录 start 节点执行
    nodeExecutions.push({
      nodeId: startNode.id,
      nodeName: startNode.name,
      nodeType: 'start',
      input,
      output: input,
      status: 'success',
      duration: 0,
    })

    // 从 start 的下一个节点开始执行
    const nextNodes = edgeMap.get(startNode.id) || []
    if (nextNodes.length === 0) {
      return {
        skillId: skill.id,
        skillName,
        input,
        output: input,
        status: 'success',
        duration: Date.now() - startTime,
        nodeExecutions,
      }
    }

    // 执行流程
    let currentNodeId: string | null = nextNodes[0]?.target || null
    let stepCount = 0
    let finalOutput: unknown

    try {
      while (currentNodeId && stepCount < this.maxSteps) {
        stepCount++

        const node = skill.nodes.find(n => n.id === currentNodeId)
        if (!node) {
          throw new SkillExecutorError(
            'UNKNOWN_NODE_TYPE',
            `Node "${currentNodeId}" not found`,
            currentNodeId
          )
        }

        // 执行节点
        const result = await this.executeNode(node, context, skill.nodes)
        nodeExecutions.push(result)

        if (result.status === 'failed') {
          return {
            skillId: skill.id,
            skillName,
            input,
            error: {
              code: 'TOOL_EXECUTION_FAILED',
              message: result.error?.message || 'Node execution failed',
              nodeId: node.id,
            },
            status: 'failed',
            duration: Date.now() - startTime,
            nodeExecutions,
          }
        }

        // 存储节点输出
        if (result.output !== undefined) {
          context.nodeOutputs.set(node.id, result.output)
        }

        // 如果是 end 节点，结束执行
        if (node.type === 'end') {
          finalOutput = result.output
          break
        }

        // 如果是 condition 节点，根据结果选择下一个节点
        if (node.type === 'condition') {
          const conditionResult = result.output as boolean
          const targetEdges = edgeMap.get(node.id) || []

          // 查找匹配的边
          const matchingEdge = targetEdges.find(edge =>
            edge.label === (conditionResult ? 'true' : 'false')
          )

          if (!matchingEdge) {
            // 没有匹配的边，尝试使用第一个可用的边
            currentNodeId = targetEdges[0]?.target || null
          } else {
            currentNodeId = matchingEdge.target
          }
        } else {
          // 其他节点按边连接顺序
          const nextEdges = edgeMap.get(node.id) || []
          currentNodeId = nextEdges[0]?.target || null
        }
      }

      if (stepCount >= this.maxSteps) {
        throw new SkillExecutorError(
          'CYCLE_DETECTED',
          `Execution exceeded max steps (${this.maxSteps}), possible cycle detected`
        )
      }

      return {
        skillId: skill.id,
        skillName,
        input,
        output: finalOutput,
        status: 'success',
        duration: Date.now() - startTime,
        nodeExecutions,
      }
    } catch (error) {
      const err = error instanceof SkillExecutorError
        ? error
        : new SkillExecutorError('TOOL_EXECUTION_FAILED', String(error))

      return {
        skillId: skill.id,
        skillName,
        input,
        error: {
          code: err.code,
          message: err.message,
          nodeId: err.nodeId,
        },
        status: 'failed',
        duration: Date.now() - startTime,
        nodeExecutions,
      }
    }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(
    node: SkillNode,
    context: SkillExecutionContext,
    allNodes: SkillNode[]
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    switch (node.type) {
      case 'start':
        // Start 节点已在初始化时处理
        return {
          nodeId: node.id,
          nodeName: node.name,
          nodeType: 'start',
          input: context.input,
          output: context.input,
          status: 'success',
          duration: Date.now() - startTime,
        }

      case 'end':
        // End 节点返回最终结果
        const output = this.evaluateOutputMapping(node.config.outputMapping || {}, context, allNodes)
        return {
          nodeId: node.id,
          nodeName: node.name,
          nodeType: 'end',
          output,
          status: 'success',
          duration: Date.now() - startTime,
        }

      case 'tool':
        return this.executeToolNode(node, context)

      case 'condition':
        return this.executeConditionNode(node, context)

      default:
        return {
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          error: { code: 'UNKNOWN_NODE_TYPE', message: `Unknown node type: ${node.type}` },
          status: 'failed',
          duration: Date.now() - startTime,
        }
    }
  }

  /**
   * 执行 Tool 节点
   */
  private async executeToolNode(
    node: SkillNode,
    context: SkillExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    const toolName = node.config.toolName!

    try {
      // 构建工具参数
      const args = this.evaluateInputMapping(node.config.inputMapping || {}, context)

      // 调用工具
      const result = await this.toolExecutor.execute(toolName, args)

      if (result.error) {
        return {
          nodeId: node.id,
          nodeName: node.name,
          nodeType: 'tool',
          input: args,
          error: { code: 'TOOL_EXECUTION_FAILED', message: result.error.message },
          status: 'failed',
          duration: Date.now() - startTime,
        }
      }

      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: 'tool',
        input: args,
        output: result.result,
        status: 'success',
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: 'tool',
        error: { code: 'TOOL_EXECUTION_FAILED', message: String(error) },
        status: 'failed',
        duration: Date.now() - startTime,
      }
    }
  }

  /**
   * 执行 Condition 节点
   */
  private executeConditionNode(
    node: SkillNode,
    context: SkillExecutionContext
  ): NodeExecutionResult {
    const startTime = Date.now()

    try {
      const condition = node.config.condition!
      const result = this.evaluateCondition(condition, context)

      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: 'condition',
        output: result,
        status: 'success',
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: 'condition',
        error: { code: 'CONDITION_EVALUATION_FAILED', message: String(error) },
        status: 'failed',
        duration: Date.now() - startTime,
      }
    }
  }

  /**
   * 构建边映射（source -> [targets with labels]）
   */
  private buildEdgeMap(skill: Skill): Map<string, Array<{ target: string; label?: string }>> {
    const map = new Map<string, Array<{ target: string; label?: string }>>()

    for (const edge of skill.edges) {
      const targets = map.get(edge.source) || []
      targets.push({ target: edge.target, label: edge.label })
      map.set(edge.source, targets)
    }

    return map
  }

  /**
   * 评估输入映射
   */
  private evaluateInputMapping(
    mapping: Record<string, string>,
    context: SkillExecutionContext
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, expression] of Object.entries(mapping)) {
      result[key] = this.evaluateExpression(expression, context)
    }

    return result
  }

  /**
   * 评估输出映射
   */
  private evaluateOutputMapping(
    mapping: Record<string, string>,
    context: SkillExecutionContext,
    allNodes?: SkillNode[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, expression] of Object.entries(mapping)) {
      result[key] = this.evaluateExpression(expression, context, allNodes)
    }

    return result
  }

  /**
   * 评估表达式
   * 支持：
   * - `${input.field}` - 引用 Skill 输入
   * - `${last.field}` - 引用最后一个节点的输出
   * - `${nodeId.field}` - 引用节点输出字段
   * - `"固定值"` - 字符串固定值
   * - 数字、布尔值
   */
  private evaluateExpression(
    expression: string,
    context: SkillExecutionContext,
    allNodes?: SkillNode[]
  ): unknown {
    // 字符串固定值
    if (expression.startsWith('"') && expression.endsWith('"')) {
      return expression.slice(1, -1)
    }

    // 数字
    const num = Number(expression)
    if (!isNaN(num) && expression.trim() !== '') {
      return num
    }

    // 布尔值
    if (expression === 'true') return true
    if (expression === 'false') return false

    // 变量引用
    if (expression.startsWith('${') && expression.endsWith('}')) {
      const path = expression.slice(2, -1)
      return this.resolvePath(path, context, allNodes)
    }

    // 其他情况作为字符串
    return expression
  }

  /**
   * 解析路径
   * 支持：
   * - `input.field` - 引用 Skill 输入
   * - `nodeId.field` - 引用指定节点输出
   */
  private resolvePath(path: string, context: SkillExecutionContext, allNodes?: SkillNode[]): unknown {
    const parts = path.split('.')

    if (parts.length === 0) {
      throw new SkillExecutorError('INVALID_EXPRESSION', `Invalid path: ${path}`)
    }

    // 第一个部分决定来源
    const source = parts[0]

    let value: unknown

    if (source === 'input') {
      value = context.input
    } else {
      // 假设是节点 ID，直接查找
      value = context.nodeOutputs.get(source)
    }

    // 遍历剩余路径
    for (let i = 1; i < parts.length && value !== undefined; i++) {
      if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, unknown>)[parts[i]]
      } else {
        return undefined
      }
    }

    return value
  }

  /**
   * 评估条件表达式
   * 支持：==, !=, >, <, >=, <=, contains
   */
  private evaluateCondition(condition: string, context: SkillExecutionContext): boolean {
    // 支持的操作符（按长度降序排列以避免误匹配）
    const operators = ['==', '!=', '>=', '<=', '>', '<', 'contains']

    for (const op of operators) {
      if (condition.includes(op)) {
        const parts = condition.split(op)
        if (parts.length !== 2) continue

        const left = parts[0].trim()
        const right = parts[1].trim()

        const leftValue = this.evaluateExpression(left, context)
        const rightValue = this.evaluateExpression(right, context)

        return this.compare(leftValue, rightValue, op)
      }
    }

    // 无操作符，直接评估为布尔值
    const value = this.evaluateExpression(condition, context)
    return Boolean(value)
  }

  /**
   * 比较两个值
   */
  private compare(left: unknown, right: unknown, op: string): boolean {
    switch (op) {
      case '==':
        return left === right
      case '!=':
        return left !== right
      case '>':
        return Number(left) > Number(right)
      case '<':
        return Number(left) < Number(right)
      case '>=':
        return Number(left) >= Number(right)
      case '<=':
        return Number(left) <= Number(right)
      case 'contains':
        return String(left).includes(String(right))
      default:
        return false
    }
  }
}