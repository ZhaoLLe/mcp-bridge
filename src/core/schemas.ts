/**
 * Zod Schema 定义（请求校验）
 */

import { z } from 'zod'

/**
 * InputSchema 校验
 */
export const InputSchemaZod = z.object({
  type: z.literal('object'),
  properties: z.record(z.object({
    type: z.string(),
    description: z.string().optional(),
    enum: z.array(z.string()).optional(),
    default: z.unknown().optional()
  })),
  required: z.array(z.string()).optional()
})

/**
 * HTTP Handler 校验
 */
export const HttpHandlerSchema = z.object({
  type: z.literal('http'),
  url: z.string().url('请输入有效的 URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('POST'),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().min(1000).max(300000).optional()
})

/**
 * WebSocket Handler 校验
 */
export const WebSocketHandlerSchema = z.object({
  type: z.literal('websocket'),
  action: z.string().optional(),
  timeout: z.number().int().min(1000).max(300000).optional(),
  target: z.enum(['all', 'first', 'specific']).optional(),
  clientId: z.string().optional()
})

/**
 * Skill Handler 校验
 */
export const SkillHandlerSchema = z.object({
  type: z.literal('skill'),
  skillName: z.string()
})

/**
 * Tool Handler 类型校验
 */
export const ToolHandlerSchema = z.union([
  WebSocketHandlerSchema,
  SkillHandlerSchema,
  HttpHandlerSchema
])

/**
 * 创建工具请求校验
 */
export const CreateToolSchema = z.object({
  name: z.string()
    .min(1, '工具名称不能为空')
    .max(64, '工具名称最长 64 字符')
    .regex(/^[a-z][a-z0-9_-]*$/, '工具名称必须以小写字母开头，只能包含小写字母、数字、下划线和连字符'),
  description: z.string()
    .min(1, '描述不能为空')
    .max(1024, '描述最长 1024 字符'),
  inputSchema: InputSchemaZod,
  handler: ToolHandlerSchema
})

/**
 * 更新工具请求校验
 */
export const UpdateToolSchema = z.object({
  description: z.string().min(1).max(1024).optional(),
  inputSchema: InputSchemaZod.optional(),
  handler: ToolHandlerSchema.optional()
})

/**
 * WebSocket 注册消息校验
 */
export const WSRegisterSchema = z.object({
  type: z.literal('register'),
  clientId: z.string().optional(),
  capabilities: z.array(z.string()).optional()
})

/**
 * WebSocket 订阅消息校验
 */
export const WSSubscribeSchema = z.object({
  type: z.literal('subscribe'),
  events: z.array(z.enum(['tool_invoked', 'tool_registered', 'tool_deleted', 'tool_updated']))
})

/**
 * WebSocket 取消订阅消息校验
 */
export const WSUnsubscribeSchema = z.object({
  type: z.literal('unsubscribe'),
  events: z.array(z.enum(['tool_invoked', 'tool_registered', 'tool_deleted', 'tool_updated']))
})

/**
 * WebSocket 工具响应消息校验
 */
export const WSToolResponseSchema = z.object({
  type: z.literal('tool_response'),
  requestId: z.string(),
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string()
  }).nullable().optional()
})

// ==================== Skill 相关 Schema ====================

/**
 * Skill 节点配置校验
 */
export const SkillNodeConfigSchema = z.object({
  inputSchema: InputSchemaZod.optional(),
  toolName: z.string().optional(),
  inputMapping: z.record(z.string()).optional(),
  condition: z.string().optional(),
  outputMapping: z.record(z.string()).optional()
})

/**
 * Skill 节点校验
 */
export const SkillNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['start', 'end', 'tool', 'condition']),
  name: z.string(),
  config: SkillNodeConfigSchema,
  position: z.object({
    x: z.number(),
    y: z.number()
  })
})

/**
 * Skill 边校验
 */
export const SkillEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional()
})

/**
 * Skill 暴露模式校验
 */
export const SkillExposeModesSchema = z.object({
  asSkill: z.boolean(),
  asTool: z.boolean(),
  asPrompt: z.boolean()
})

/**
 * 创建 Skill 请求校验
 */
export const CreateSkillSchema = z.object({
  name: z.string()
    .min(1, 'Skill 名称不能为空')
    .max(64, 'Skill 名称最长 64 字符')
    .regex(/^[a-z][a-z0-9_-]*$/, 'Skill 名称必须以小写字母开头，只能包含小写字母、数字、下划线和连字符'),
  displayName: z.string()
    .min(1, '显示名称不能为空')
    .max(128, '显示名称最长 128 字符'),
  description: z.string()
    .min(1, '描述不能为空')
    .max(1024, '描述最长 1024 字符'),
  triggerPhrases: z.array(z.string()).optional(),
  exposeModes: SkillExposeModesSchema.partial().optional(),
  inputSchema: InputSchemaZod,
  outputSchema: InputSchemaZod.optional(),
  nodes: z.array(SkillNodeSchema),
  edges: z.array(SkillEdgeSchema)
})

/**
 * 更新 Skill 请求校验
 */
export const UpdateSkillSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  description: z.string().min(1).max(1024).optional(),
  triggerPhrases: z.array(z.string()).optional(),
  exposeModes: SkillExposeModesSchema.partial().optional(),
  inputSchema: InputSchemaZod.optional(),
  outputSchema: InputSchemaZod.optional(),
  nodes: z.array(SkillNodeSchema).optional(),
  edges: z.array(SkillEdgeSchema).optional()
})