/**
 * Invoke Logs REST API 路由
 */

import { Hono } from 'hono'
import { InvokeLogStore } from '../core/invokeLogStore'
import type { ApiResponse, InvokeLogListResponse, InvokeLog, LogQueryOptions } from '../core/types'

export function createLogsRoutes(
  invokeLogStore: InvokeLogStore
) {
  const app = new Hono()

  // 获取调用日志列表
  app.get('/', (c) => {
    const type = c.req.query('type') as 'tool' | 'skill' | undefined
    const name = c.req.query('name')
    const status = c.req.query('status') as 'success' | 'failed' | 'timeout' | undefined
    const startTime = c.req.query('startTime')
    const endTime = c.req.query('endTime')
    const page = parseInt(c.req.query('page') || '1')
    const pageSize = parseInt(c.req.query('pageSize') || '20')

    const options: LogQueryOptions = {
      page,
      pageSize,
      type,
      name,
      status
    }

    if (startTime) {
      options.startTime = parseInt(startTime)
    }
    if (endTime) {
      options.endTime = parseInt(endTime)
    }

    const result = invokeLogStore.list(options)
    const response: ApiResponse<InvokeLogListResponse> = {
      success: true,
      data: result
    }
    return c.json(response)
  })

  // 获取单条日志详情
  app.get('/:id', (c) => {
    const id = c.req.param('id')
    const log = invokeLogStore.get(id)

    if (!log) {
      return c.json({
        success: false,
        error: { code: 'LOG_NOT_FOUND', message: `Log with ID '${id}' not found` }
      }, 404)
    }

    return c.json({ success: true, data: log })
  })

  // 清空所有日志
  app.delete('/clear', (c) => {
    invokeLogStore.clear()
    return c.json({ success: true, message: 'All logs cleared' })
  })

  // 获取日志统计信息
  app.get('/stats/summary', (c) => {
    const allLogs = invokeLogStore.list({ pageSize: 1000 }).logs

    const total = allLogs.length
    const successCount = allLogs.filter(l => l.status === 'success').length
    const failedCount = allLogs.filter(l => l.status === 'failed').length
    const timeoutCount = allLogs.filter(l => l.status === 'timeout').length

    const toolCount = allLogs.filter(l => l.type === 'tool').length
    const skillCount = allLogs.filter(l => l.type === 'skill').length

    // 平均耗时
    const avgDuration = total > 0
      ? Math.round(allLogs.reduce((sum, l) => sum + l.duration, 0) / total)
      : 0

    // 最近 24 小时统计
    const now = Date.now()
    const last24Hours = now - 24 * 60 * 60 * 1000
    const last24HoursLogs = allLogs.filter(l => l.timestamp >= last24Hours)
    const last24HoursCount = last24HoursLogs.length

    return c.json({
      success: true,
      data: {
        total,
        successCount,
        failedCount,
        timeoutCount,
        toolCount,
        skillCount,
        avgDuration,
        last24HoursCount,
        successRate: total > 0 ? Math.round((successCount / total) * 100) : 0
      }
    })
  })

  // 获取指定 Skill/Tool 的调用历史
  app.get('/history/:name', (c) => {
    const name = c.req.param('name')
    const limit = parseInt(c.req.query('limit') || '50')

    const result = invokeLogStore.list({
      name,
      pageSize: limit
    })

    return c.json({
      success: true,
      data: result
    })
  })

  return app
}
