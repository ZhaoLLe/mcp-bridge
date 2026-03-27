import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createToolsRoutes } from './tools'
import { ToolRegistry } from '../core/registry'
import { ToolExecutor } from '../core/executor'
import { EventEmitter } from 'events'

describe('createToolsRoutes', () => {
  let app: Hono
  let registry: ToolRegistry
  let executor: ToolExecutor
  let eventEmitter: EventEmitter

  const validTool = {
    name: 'test_tool',
    description: 'A test tool',
    inputSchema: {
      type: 'object' as const,
      properties: {
        input: { type: 'string' },
      },
      required: ['input'],
    },
    handler: { type: 'websocket' as const },
  }

  beforeEach(() => {
    registry = new ToolRegistry()
    eventEmitter = new EventEmitter()

    // Create mock executor
    const mockClientManager = {
      getClientsWithCapability: () => [],
    }
    executor = new ToolExecutor(registry, mockClientManager)

    app = new Hono()
    app.route('/api/tools', createToolsRoutes(registry, executor, eventEmitter))
  })

  describe('GET /api/tools', () => {
    it('should return empty list initially', async () => {
      const res = await app.request('/api/tools')
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.tools).toEqual([])
      expect(data.data.total).toBe(0)
    })

    it('should return list of tools', async () => {
      registry.register(validTool)

      const res = await app.request('/api/tools')
      const data = await res.json()

      expect(data.data.tools).toHaveLength(1)
      expect(data.data.tools[0].name).toBe('test_tool')
      expect(data.data.total).toBe(1)
    })
  })

  describe('GET /api/tools/mcp-config', () => {
    it('should return MCP config', async () => {
      registry.register(validTool)

      const res = await app.request('/api/tools/mcp-config')
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.serverName).toBe('mcp-bridge')
      expect(data.data.sseEndpoint).toBe('http://localhost:3000/sse')
      expect(data.data.tools).toContain('test_tool')
    })
  })

  describe('GET /api/tools/:name', () => {
    it('should return tool by name', async () => {
      registry.register(validTool)

      const res = await app.request('/api/tools/test_tool')
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('test_tool')
    })

    it('should return 404 for non-existent tool', async () => {
      const res = await app.request('/api/tools/nonexistent')
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('TOOL_NOT_FOUND')
    })
  })

  describe('POST /api/tools', () => {
    it('should register new tool', async () => {
      const res = await app.request('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validTool),
      })
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.tool.name).toBe('test_tool')
      expect(data.data.mcpConfig).toBeDefined()
    })

    it('should return 400 for validation error', async () => {
      const res = await app.request('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '123invalid', // Invalid name
          description: 'Test',
          inputSchema: { type: 'object', properties: {} },
          handler: { type: 'websocket' },
        }),
      })
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 409 for duplicate tool', async () => {
      registry.register(validTool)

      const res = await app.request('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validTool),
      })
      const data = await res.json()

      expect(res.status).toBe(409)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('DUPLICATE_TOOL')
    })

    it('should emit tool_registered event', async () => {
      const handler = vi.fn()
      eventEmitter.on('tool_registered', handler)

      await app.request('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validTool),
      })

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ tool: expect.objectContaining({ name: 'test_tool' }) })
      )
    })
  })

  describe('PUT /api/tools/:name', () => {
    it('should update tool', async () => {
      registry.register(validTool)

      const res = await app.request('/api/tools/test_tool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Updated description' }),
      })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.description).toBe('Updated description')
    })

    it('should return 404 for non-existent tool', async () => {
      const res = await app.request('/api/tools/nonexistent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Updated' }),
      })
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.error.code).toBe('TOOL_NOT_FOUND')
    })

    it('should return 400 for validation error', async () => {
      registry.register(validTool)

      const res = await app.request('/api/tools/test_tool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: '' }), // Empty description
      })
      const data = await res.json()

      expect(res.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should emit tool_updated event', async () => {
      registry.register(validTool)
      const handler = vi.fn()
      eventEmitter.on('tool_updated', handler)

      await app.request('/api/tools/test_tool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Updated' }),
      })

      expect(handler).toHaveBeenCalled()
    })
  })

  describe('DELETE /api/tools/:name', () => {
    it('should delete tool', async () => {
      registry.register(validTool)

      const res = await app.request('/api/tools/test_tool', {
        method: 'DELETE',
      })
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(registry.count).toBe(0)
    })

    it('should return 404 for non-existent tool', async () => {
      const res = await app.request('/api/tools/nonexistent', {
        method: 'DELETE',
      })
      const data = await res.json()

      expect(res.status).toBe(404)
      expect(data.error.code).toBe('TOOL_NOT_FOUND')
    })

    it('should emit tool_deleted event', async () => {
      registry.register(validTool)
      const handler = vi.fn()
      eventEmitter.on('tool_deleted', handler)

      await app.request('/api/tools/test_tool', {
        method: 'DELETE',
      })

      expect(handler).toHaveBeenCalledWith({ toolName: 'test_tool' })
    })
  })

  describe('POST /api/tools/:name/invoke', () => {
    it('should invoke tool and return result', async () => {
      registry.register({
        name: 'echo_tool',
        description: 'Echo',
        inputSchema: { type: 'object', properties: {} },
        handler: { type: 'websocket', timeout: 100 },
      })

      const res = await app.request('/api/tools/echo_tool/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      })
      const data = await res.json()

      // Will fail because no WebSocket client connected
      expect(data.data.tool).toBe('echo_tool')
      expect(data.data.arguments).toEqual({ message: 'hello' })
      expect(data.data.duration).toBeDefined()
    })

    it('should return 500 for tool not found', async () => {
      const res = await app.request('/api/tools/nonexistent/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()

      expect(res.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.data.error.code).toBe('UNKNOWN_TOOL')
    })

    it('should emit tool_invoked event', async () => {
      registry.register({
        name: 'test_tool',
        description: 'Test',
        inputSchema: { type: 'object', properties: {} },
        handler: { type: 'websocket', timeout: 100 },
      })

      const handler = vi.fn()
      eventEmitter.on('tool_invoked', handler)

      await app.request('/api/tools/test_tool/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(handler).toHaveBeenCalled()
    })
  })
})