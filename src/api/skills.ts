/**
 * Skills REST API 路由
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { SkillRegistry } from '../core/skillRegistry'
import { SkillExecutor } from '../core/skillExecutor'
import { SkillMdGenerator } from '../core/skillMdGenerator'
import { InvokeLogStore } from '../core/invokeLogStore'
import { CreateSkillSchema, UpdateSkillSchema } from '../core/schemas'
import type { ApiResponse, SkillListResponse, SkillExecutionResult } from '../core/types'
import type { EventEmitter } from 'events'

export function createSkillsRoutes(
  skillRegistry: SkillRegistry,
  skillExecutor: SkillExecutor,
  invokeLogStore: InvokeLogStore,
  eventEmitter: EventEmitter,
  toolRegistry?: import('../core/registry').ToolRegistry
) {
  const app = new Hono()
  const skillMdGenerator = new SkillMdGenerator()

  /**
   * 同步 Skill 到 MCP Tool（asTool 模式）
   */
  const syncSkillToTool = (skill: import('../core/types').Skill) => {
    if (!toolRegistry) return

    const toolName = `skill_${skill.name}`
    const existingTool = toolRegistry.get(toolName)

    if (skill.exposeModes.asTool && skill.status === 'enabled') {
      // 需要注册/更新 Tool
      const toolDefinition = {
        name: toolName,
        description: `Skill: ${skill.displayName}. ${skill.description}`,
        inputSchema: skill.inputSchema,
        handler: {
          type: 'skill' as const,
          skillName: skill.name
        }
      }

      if (!existingTool) {
        // 注册新 Tool
        try {
          toolRegistry.register(toolDefinition)
          eventEmitter.emit('tool_registered', { tool: toolDefinition })
        } catch (err) {
          console.error(`Failed to register tool ${toolName}:`, err)
        }
      } else {
        // 更新现有 Tool
        try {
          toolRegistry.update(toolName, {
            description: toolDefinition.description,
            inputSchema: toolDefinition.inputSchema,
            handler: toolDefinition.handler
          })
          eventEmitter.emit('tool_updated', { tool: toolDefinition })
        } catch (err) {
          console.error(`Failed to update tool ${toolName}:`, err)
        }
      }
    } else {
      // 不需要 asTool 模式，删除对应的 Tool
      if (existingTool) {
        try {
          toolRegistry.delete(toolName)
          eventEmitter.emit('tool_deleted', { toolName: toolName })
        } catch (err) {
          console.error(`Failed to delete tool ${toolName}:`, err)
        }
      }
    }
  }

  // 列出所有 Skills
  app.get('/', async (c) => {
    const page = parseInt(c.req.query('page') || '1')
    const pageSize = parseInt(c.req.query('pageSize') || '20')
    const status = c.req.query('status') as 'enabled' | 'disabled' | undefined
    const search = c.req.query('search')

    const result = skillRegistry.list({ page, pageSize, status, search })
    const response: ApiResponse<SkillListResponse> = {
      success: true,
      data: result
    }
    return c.json(response)
  })

  // 获取单个 Skill
  app.get('/:name', (c) => {
    const name = c.req.param('name')
    const skill = skillRegistry.get(name)

    if (!skill) {
      const response: ApiResponse = {
        success: false,
        error: { code: 'SKILL_NOT_FOUND', message: `Skill '${name}' not found` }
      }
      return c.json(response, 404)
    }

    return c.json({ success: true, data: skill })
  })

  // 获取 Skill by ID
  app.get('/id/:id', (c) => {
    const id = c.req.param('id')
    const skill = skillRegistry.getById(id)

    if (!skill) {
      const response: ApiResponse = {
        success: false,
        error: { code: 'SKILL_NOT_FOUND', message: `Skill with ID '${id}' not found` }
      }
      return c.json(response, 404)
    }

    return c.json({ success: true, data: skill })
  })

  // 创建 Skill
  app.post('/', async (c) => {
    try {
      const body = await c.req.json()
      const validated = CreateSkillSchema.parse(body)

      const skill = skillRegistry.register(validated)

      // 同步到 MCP Tool（如果启用 asTool 模式）
      syncSkillToTool(skill)

      // 触发事件
      eventEmitter.emit('skill_registered', { skill })

      const response: ApiResponse = {
        success: true,
        data: skill
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
            error: { code: 'DUPLICATE_SKILL', message: err.message }
          }, 409)
        }
      }
      throw err
    }
  })

  // 更新 Skill
  app.put('/:name', async (c) => {
    const name = c.req.param('name')

    try {
      const body = await c.req.json()
      const validated = UpdateSkillSchema.parse(body)

      const skill = skillRegistry.update(name, validated)

      // 同步到 MCP Tool（如果启用 asTool 模式）
      syncSkillToTool(skill)

      eventEmitter.emit('skill_updated', { skill })

      return c.json({ success: true, data: skill })
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
          error: { code: 'SKILL_NOT_FOUND', message: err.message }
        }, 404)
      }
      throw err
    }
  })

  // 删除 Skill
  app.delete('/:name', (c) => {
    const name = c.req.param('name')
    const skill = skillRegistry.get(name)
    const deleted = skillRegistry.delete(name)

    if (!deleted) {
      return c.json({
        success: false,
        error: { code: 'SKILL_NOT_FOUND', message: `Skill '${name}' not found` }
      }, 404)
    }

    // 同步删除对应的 MCP Tool
    if (skill && toolRegistry) {
      const toolName = `skill_${name}`
      try {
        toolRegistry.delete(toolName)
        eventEmitter.emit('tool_deleted', { toolName: toolName })
      } catch (err) {
        console.error(`Failed to delete tool ${toolName}:`, err)
      }
    }

    eventEmitter.emit('skill_deleted', { skillName: name })

    return c.json({ success: true })
  })

  // 切换 Skill 状态
  app.post('/:name/toggle', (c) => {
    const name = c.req.param('name')

    try {
      const skill = skillRegistry.toggleStatus(name)

      // 同步到 MCP Tool（如果启用 asTool 模式）
      syncSkillToTool(skill)

      eventEmitter.emit('skill_updated', { skill })
      return c.json({ success: true, data: skill })
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return c.json({
          success: false,
          error: { code: 'SKILL_NOT_FOUND', message: err.message }
        }, 404)
      }
      throw err
    }
  })

  // 更新触发短语
  app.put('/:name/trigger-phrases', async (c) => {
    const name = c.req.param('name')
    const body = await c.req.json()
    const { phrases } = body

    if (!Array.isArray(phrases)) {
      return c.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'phrases must be an array' }
      }, 400)
    }

    try {
      const skill = skillRegistry.updateTriggerPhrases(name, phrases)
      eventEmitter.emit('skill_updated', { skill })
      return c.json({ success: true, data: skill })
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return c.json({
          success: false,
          error: { code: 'SKILL_NOT_FOUND', message: err.message }
        }, 404)
      }
      throw err
    }
  })

  // 更新暴露模式
  app.put('/:name/expose-modes', async (c) => {
    const name = c.req.param('name')
    const body = await c.req.json()
    const { asSkill, asTool, asPrompt } = body

    try {
      const skill = skillRegistry.updateExposeModes(name, { asSkill, asTool, asPrompt })

      // 同步到 MCP Tool（如果启用 asTool 模式）
      syncSkillToTool(skill)

      eventEmitter.emit('skill_updated', { skill })
      return c.json({ success: true, data: skill })
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return c.json({
          success: false,
          error: { code: 'SKILL_NOT_FOUND', message: err.message }
        }, 404)
      }
      throw err
    }
  })

  // 生成 SKILL.md
  app.get('/:name/skill-md', (c) => {
    const name = c.req.param('name')
    const skill = skillRegistry.get(name)

    if (!skill) {
      return c.json({
        success: false,
        error: { code: 'SKILL_NOT_FOUND', message: `Skill '${name}' not found` }
      }, 404)
    }

    const markdown = skillMdGenerator.generate(skill)
    return c.text(markdown, 200, {
      'Content-Type': 'text/markdown'
    })
  })

  // 下载 SKILL.md 文件
  app.get('/:name/skill-md/download', (c) => {
    const name = c.req.param('name')
    const skill = skillRegistry.get(name)

    if (!skill) {
      return c.json({
        success: false,
        error: { code: 'SKILL_NOT_FOUND', message: `Skill '${name}' not found` }
      }, 404)
    }

    const markdown = skillMdGenerator.generate(skill)
    return c.body(markdown, 200, {
      'Content-Type': 'text/markdown',
      'Content-Disposition': `attachment; filename="SKILL.md"`
    })
  })

  // 生成 Prompt 模板
  app.get('/:name/prompt-template', (c) => {
    const name = c.req.param('name')
    const skill = skillRegistry.get(name)

    if (!skill) {
      return c.json({
        success: false,
        error: { code: 'SKILL_NOT_FOUND', message: `Skill '${name}' not found` }
      }, 404)
    }

    const promptTemplate = skillMdGenerator.generatePromptTemplate(skill)
    return c.text(promptTemplate, 200, {
      'Content-Type': 'text/plain'
    })
  })

  // 下载 Prompt 模板文件
  app.get('/:name/prompt-template/download', (c) => {
    const name = c.req.param('name')
    const skill = skillRegistry.get(name)

    if (!skill) {
      return c.json({
        success: false,
        error: { code: 'SKILL_NOT_FOUND', message: `Skill '${name}' not found` }
      }, 404)
    }

    const promptTemplate = skillMdGenerator.generatePromptTemplate(skill)
    return c.body(promptTemplate, 200, {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="PROMPT.txt"`
    })
  })

  // 调用 Skill（测试用）
  app.post('/:name/invoke', async (c) => {
    const name = c.req.param('name')
    const args = await c.req.json().catch(() => ({}))

    const startTime = Date.now()
    const result = await skillExecutor.execute(name, args)
    const duration = Date.now() - startTime

    // 记录日志
    const log = InvokeLogStore.createSkillLog({
      name,
      skillId: result.skillId,
      arguments: args,
      result: result.output,
      error: result.error,
      status: result.status,
      duration,
      subCalls: result.nodeExecutions
        ?.filter(nodeExec => nodeExec.nodeType === 'tool')
        .map(nodeExec => ({
          id: `log_${nodeExec.nodeId}_${Date.now()}`,
          type: 'tool' as const,
          name: nodeExec.nodeName,
          arguments: nodeExec.input || {},
          result: nodeExec.output,
          error: nodeExec.error,
          status: nodeExec.status === 'failed' ? 'failed' : 'success' as 'success' | 'failed' | 'timeout',
          duration: nodeExec.duration,
          timestamp: Date.now()
        }))
    })
    invokeLogStore.add(log)

    // 触发事件
    eventEmitter.emit('skill_invoked', {
      skill: name,
      arguments: args,
      result: result.output,
      error: result.error,
      duration,
      log
    })

    const response: ApiResponse<SkillExecutionResult> = {
      success: result.status === 'success',
      data: result
    }

    return c.json(response, result.status === 'success' ? 200 : 500)
  })

  // 获取引用了指定工具的 Skill 列表
  app.get('/references/tool/:toolName', (c) => {
    const toolName = c.req.param('toolName')
    const skills = skillRegistry.getSkillsUsingTool(toolName)
    const response: ApiResponse<SkillListResponse> = {
      success: true,
      data: { skills, total: skills.length }
    }
    return c.json(response)
  })

  // 获取所有被引用的工具名称
  app.get('/references/all-tools', (c) => {
    const tools = skillRegistry.getReferencedTools()
    const response: ApiResponse<string[]> = {
      success: true,
      data: Array.from(tools)
    }
    return c.json(response)
  })

  return app
}
