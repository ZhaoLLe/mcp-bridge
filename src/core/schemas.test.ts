import { describe, it, expect } from 'vitest'
import {
  InputSchemaZod,
  WebSocketHandlerSchema,
  CreateToolSchema,
  UpdateToolSchema,
  WSRegisterSchema,
  WSSubscribeSchema,
  WSUnsubscribeSchema,
  WSToolResponseSchema,
} from './schemas'

describe('InputSchemaZod', () => {
  it('should validate valid input schema', () => {
    const result = InputSchemaZod.safeParse({
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name' },
      },
      required: ['name'],
    })
    expect(result.success).toBe(true)
  })

  it('should accept optional fields', () => {
    const result = InputSchemaZod.safeParse({
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'inactive'] },
        count: { type: 'number', default: 0 },
      },
    })
    expect(result.success).toBe(true)
  })

  it('should reject non-object type', () => {
    const result = InputSchemaZod.safeParse({
      type: 'string',
      properties: {},
    })
    expect(result.success).toBe(false)
  })
})

describe('WebSocketHandlerSchema', () => {
  it('should validate minimal handler', () => {
    const result = WebSocketHandlerSchema.safeParse({
      type: 'websocket',
    })
    expect(result.success).toBe(true)
  })

  it('should validate full handler config', () => {
    const result = WebSocketHandlerSchema.safeParse({
      type: 'websocket',
      action: 'confirm',
      timeout: 60000,
      target: 'specific',
      clientId: 'client-123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject timeout below minimum', () => {
    const result = WebSocketHandlerSchema.safeParse({
      type: 'websocket',
      timeout: 500, // below 1000ms minimum
    })
    expect(result.success).toBe(false)
  })

  it('should reject timeout above maximum', () => {
    const result = WebSocketHandlerSchema.safeParse({
      type: 'websocket',
      timeout: 400000, // above 300000ms maximum
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid target', () => {
    const result = WebSocketHandlerSchema.safeParse({
      type: 'websocket',
      target: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateToolSchema', () => {
  const validTool = {
    name: 'my_tool',
    description: 'A test tool',
    inputSchema: {
      type: 'object' as const,
      properties: {
        input: { type: 'string' },
      },
    },
    handler: { type: 'websocket' as const },
  }

  it('should validate valid tool', () => {
    const result = CreateToolSchema.safeParse(validTool)
    expect(result.success).toBe(true)
  })

  it('should reject empty name', () => {
    const result = CreateToolSchema.safeParse({
      ...validTool,
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('should reject name starting with number', () => {
    const result = CreateToolSchema.safeParse({
      ...validTool,
      name: '1tool',
    })
    expect(result.success).toBe(false)
  })

  it('should reject name with uppercase letters', () => {
    const result = CreateToolSchema.safeParse({
      ...validTool,
      name: 'MyTool',
    })
    expect(result.success).toBe(false)
  })

  it('should reject name with spaces', () => {
    const result = CreateToolSchema.safeParse({
      ...validTool,
      name: 'my tool',
    })
    expect(result.success).toBe(false)
  })

  it('should accept name with underscores', () => {
    const result = CreateToolSchema.safeParse({
      ...validTool,
      name: 'my_tool_name',
    })
    expect(result.success).toBe(true)
  })

  it('should reject name longer than 64 chars', () => {
    const result = CreateToolSchema.safeParse({
      ...validTool,
      name: 'a'.repeat(65),
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty description', () => {
    const result = CreateToolSchema.safeParse({
      ...validTool,
      description: '',
    })
    expect(result.success).toBe(false)
  })

  it('should reject description longer than 1024 chars', () => {
    const result = CreateToolSchema.safeParse({
      ...validTool,
      description: 'a'.repeat(1025),
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateToolSchema', () => {
  it('should validate partial update', () => {
    const result = UpdateToolSchema.safeParse({
      description: 'Updated description',
    })
    expect(result.success).toBe(true)
  })

  it('should validate full update', () => {
    const result = UpdateToolSchema.safeParse({
      description: 'Updated',
      inputSchema: {
        type: 'object' as const,
        properties: { new: { type: 'string' } },
      },
      handler: { type: 'websocket' as const },
    })
    expect(result.success).toBe(true)
  })

  it('should accept empty object', () => {
    const result = UpdateToolSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('WSRegisterSchema', () => {
  it('should validate minimal register', () => {
    const result = WSRegisterSchema.safeParse({ type: 'register' })
    expect(result.success).toBe(true)
  })

  it('should validate full register', () => {
    const result = WSRegisterSchema.safeParse({
      type: 'register',
      clientId: 'my-client',
      capabilities: ['tool1', 'tool2'],
    })
    expect(result.success).toBe(true)
  })

  it('should reject wrong type', () => {
    const result = WSRegisterSchema.safeParse({
      type: 'wrong',
    })
    expect(result.success).toBe(false)
  })
})

describe('WSSubscribeSchema', () => {
  it('should validate valid events', () => {
    const result = WSSubscribeSchema.safeParse({
      type: 'subscribe',
      events: ['tool_invoked', 'tool_registered'],
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid event', () => {
    const result = WSSubscribeSchema.safeParse({
      type: 'subscribe',
      events: ['invalid_event'],
    })
    expect(result.success).toBe(false)
  })
})

describe('WSUnsubscribeSchema', () => {
  it('should validate valid events', () => {
    const result = WSUnsubscribeSchema.safeParse({
      type: 'unsubscribe',
      events: ['tool_invoked'],
    })
    expect(result.success).toBe(true)
  })
})

describe('WSToolResponseSchema', () => {
  it('should validate success response', () => {
    const result = WSToolResponseSchema.safeParse({
      type: 'tool_response',
      requestId: 'req-123',
      success: true,
      result: { data: 'test' },
    })
    expect(result.success).toBe(true)
  })

  it('should validate error response', () => {
    const result = WSToolResponseSchema.safeParse({
      type: 'tool_response',
      requestId: 'req-123',
      success: false,
      error: {
        code: 'EXECUTION_FAILED',
        message: 'Something went wrong',
      },
    })
    expect(result.success).toBe(true)
  })

  it('should reject missing requestId', () => {
    const result = WSToolResponseSchema.safeParse({
      type: 'tool_response',
      success: true,
    })
    expect(result.success).toBe(false)
  })
})