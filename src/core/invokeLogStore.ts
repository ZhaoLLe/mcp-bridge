/**
 * 调用日志存储
 * 记录 Tool 和 Skill 的调用历史
 */

import type { InvokeLog, InvokeLogListResponse, LogQueryOptions } from './types'

/**
 * 日志存储配置
 */
export interface InvokeLogStoreConfig {
  /** 最大日志数量，默认 1000 */
  maxSize?: number
}

/**
 * 调用日志存储
 */
export class InvokeLogStore {
  private logs: InvokeLog[] = []
  private maxSize: number

  constructor(config: InvokeLogStoreConfig = {}) {
    this.maxSize = config.maxSize ?? 1000
  }

  /**
   * 添加日志
   */
  add(log: InvokeLog): void {
    // FIFO 淘汰
    if (this.logs.length >= this.maxSize) {
      this.logs.shift()
    }
    this.logs.push(log)
  }

  /**
   * 获取日志列表（分页）
   */
  list(options: LogQueryOptions = {}): InvokeLogListResponse {
    let logs = [...this.logs]

    // 类型筛选
    if (options.type) {
      logs = logs.filter(l => l.type === options.type)
    }

    // 名称筛选
    if (options.name) {
      const search = options.name.toLowerCase()
      logs = logs.filter(l => l.name.toLowerCase().includes(search))
    }

    // 状态筛选
    if (options.status) {
      logs = logs.filter(l => l.status === options.status)
    }

    // 时间范围筛选
    if (options.startTime) {
      logs = logs.filter(l => l.timestamp >= options.startTime!)
    }
    if (options.endTime) {
      logs = logs.filter(l => l.timestamp <= options.endTime!)
    }

    // 排序（按时间倒序）
    logs.sort((a, b) => b.timestamp - a.timestamp)

    const total = logs.length

    // 分页
    const page = options.page ?? 1
    const pageSize = options.pageSize ?? 20
    const start = (page - 1) * pageSize
    const end = start + pageSize
    logs = logs.slice(start, end)

    return { logs, total }
  }

  /**
   * 获取单条日志
   */
  get(id: string): InvokeLog | undefined {
    return this.logs.find(l => l.id === id)
  }

  /**
   * 清空日志
   */
  clear(): void {
    this.logs = []
  }

  /**
   * 获取日志数量
   */
  get count(): number {
    return this.logs.length
  }

  /**
   * 创建工具调用日志
   */
  static createToolLog(params: {
    name: string
    arguments: Record<string, unknown>
    result?: unknown
    error?: { code: string; message: string }
    status: 'success' | 'failed' | 'timeout'
    duration: number
  }): InvokeLog {
    return {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'tool',
      name: params.name,
      arguments: params.arguments,
      result: params.result,
      error: params.error,
      status: params.status,
      duration: params.duration,
      timestamp: Date.now(),
    }
  }

  /**
   * 创建 Skill 调用日志
   */
  static createSkillLog(params: {
    name: string
    skillId: string
    arguments: Record<string, unknown>
    result?: unknown
    error?: { code: string; message: string }
    status: 'success' | 'failed' | 'timeout'
    duration: number
    subCalls?: InvokeLog[]
  }): InvokeLog {
    return {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'skill',
      name: params.name,
      skillId: params.skillId,
      arguments: params.arguments,
      result: params.result,
      error: params.error,
      status: params.status,
      duration: params.duration,
      timestamp: Date.now(),
      subCalls: params.subCalls,
    }
  }
}