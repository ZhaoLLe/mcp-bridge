/**
 * Tools REST API 路由
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { ToolRegistry } from '../core/registry'
import { ToolExecutor } from '../core/executor'
import { CreateToolSchema, UpdateToolSchema, ToolHandlerSchema } from '../core/schemas'
import type {
  ApiResponse,
  ToolListResponse,
  ToolInvokeResult,
  RegisterToolResponse,
  ToolHandler
} from '../core/types'
import type { EventEmitter } from 'events'

export function createToolsRoutes(
  registry: ToolRegistry,
  executor: ToolExecutor,
  eventEmitter: EventEmitter,
  skillRegistry?: import('../core/skillRegistry').SkillRegistry
) {
  const app = new Hono()

  // 列出所有工具
  app.get('/', (c) => {
    const tools = registry.getAll()
    const response: ApiResponse<ToolListResponse> = {
      success: true,
      data: { tools, total: tools.length }
    }
    return c.json(response)
  })

  // 获取 MCP 配置（必须在 /:name 之前）
  app.get('/mcp-config', (c) => {
    const mcpConfig = registry.generateMCPConfig()
    return c.json({ success: true, data: mcpConfig })
  })

  // 获取单个工具
  app.get('/:name', (c) => {
    const name = c.req.param('name')
    const tool = registry.get(name)

    if (!tool) {
      const response: ApiResponse = {
        success: false,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool '${name}' not found` }
      }
      return c.json(response, 404)
    }

    return c.json({ success: true, data: tool })
  })

  // 注册工具（返回 MCP 配置）
  app.post('/', async (c) => {
    try {
      const body = await c.req.json()
      const validated = CreateToolSchema.parse(body)

      // 如果是 skill handler，验证 skill 是否存在
      if (validated.handler.type === 'skill') {
        if (!skillRegistry) {
          return c.json({
            success: false,
            error: { code: 'CONFIGURATION_ERROR', message: 'Skill registry not configured' }
          }, 500)
        }
        const skill = skillRegistry.get(validated.handler.skillName)
        if (!skill) {
          return c.json({
            success: false,
            error: { code: 'SKILL_NOT_FOUND', message: `Skill '${validated.handler.skillName}' not found` }
          }, 404)
        }
      }

      const tool = registry.register(validated)

      // 生成 MCP 配置
      const mcpConfig = registry.generateMCPConfig()

      // 触发事件
      eventEmitter.emit('tool_registered', { tool })

      const response: ApiResponse<RegisterToolResponse> = {
        success: true,
        data: {
          tool,
          mcpConfig
        }
      }

      return c.json(response, 201)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return c.json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: err.errors[0].message }
        }, 400)
      }
      if (err instanceof Error) {
        if (err.message.includes('already exists')) {
          return c.json({
            success: false,
            error: { code: 'DUPLICATE_TOOL', message: err.message }
          }, 409)
        }
      }
      throw err
    }
  })

  // 更新工具
  app.put('/:name', async (c) => {
    const name = c.req.param('name')

    try {
      const body = await c.req.json()
      const validated = UpdateToolSchema.parse(body)

      const tool = registry.update(name, validated)

      eventEmitter.emit('tool_updated', { tool })

      return c.json({ success: true, data: tool })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return c.json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: err.errors[0].message }
        }, 400)
      }
      if (err instanceof Error && err.message.includes('not found')) {
        return c.json({
          success: false,
          error: { code: 'TOOL_NOT_FOUND', message: err.message }
        }, 404)
      }
      throw err
    }
  })

  // 删除工具
  app.delete('/:name', (c) => {
    const name = c.req.param('name')
    const deleted = registry.delete(name)

    if (!deleted) {
      return c.json({
        success: false,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool '${name}' not found` }
      }, 404)
    }

    eventEmitter.emit('tool_deleted', { toolName: name })

    return c.json({ success: true })
  })

  // 调用工具（测试用）
  app.post('/:name/invoke', async (c) => {
    const name = c.req.param('name')
    const args = await c.req.json().catch(() => ({}))

    const startTime = Date.now()
    const result = await executor.execute(name, args)
    const duration = Date.now() - startTime

    const response: ApiResponse<ToolInvokeResult> = {
      success: result.success,
      data: {
        tool: name,
        arguments: args,
        result: result.result,
        error: result.error,
        duration
      }
    }

    // 触发事件
    eventEmitter.emit('tool_invoked', {
      tool: name,
      arguments: args,
      result: result.result,
      error: result.error,
      duration
    })

    return c.json(response, result.success ? 200 : 500)
  })

  // 切换工具状态
  app.post('/:name/toggle', (c) => {
    const name = c.req.param('name')

    try {
      const tool = registry.toggleStatus(name)
      eventEmitter.emit('tool_updated', { tool })
      return c.json({ success: true, data: tool })
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return c.json({
          success: false,
          error: { code: 'TOOL_NOT_FOUND', message: err.message }
        }, 404)
      }
      throw err
    }
  })

  return app
}