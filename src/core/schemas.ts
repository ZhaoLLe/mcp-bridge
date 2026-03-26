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
 * 创建工具请求校验
 */
export const CreateToolSchema = z.object({
  name: z.string()
    .min(1, '工具名称不能为空')
    .max(64, '工具名称最长 64 字符')
    .regex(/^[a-z][a-z0-9_]*$/, '工具名称必须以小写字母开头，只能包含小写字母、数字和下划线'),
  description: z.string()
    .min(1, '描述不能为空')
    .max(1024, '描述最长 1024 字符'),
  inputSchema: InputSchemaZod,
  handler: WebSocketHandlerSchema
})

/**
 * 更新工具请求校验
 */
export const UpdateToolSchema = z.object({
  description: z.string().min(1).max(1024).optional(),
  inputSchema: InputSchemaZod.optional(),
  handler: WebSocketHandlerSchema.optional()
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