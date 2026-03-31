import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from './registry'
import type { CreateToolRequest } from './types'

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  const createTool = (name: string): CreateToolRequest => ({
    name,
    description: `Tool ${name}`,
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
    },
    handler: { type: 'websocket' },
  })

  beforeEach(() => {
    registry = new ToolRegistry('http://localhost:3000', 'test-bridge')
  })

  describe('register()', () => {
    it('should register a tool', () => {
      const tool = registry.register(createTool('test_tool'))

      expect(tool.name).toBe('test_tool')
      expect(tool.description).toBe('Tool test_tool')
      expect(tool.status).toBe('enabled')
      expect(tool.createdAt).toBe(tool.updatedAt)
    })

    it('should throw error for duplicate tool', () => {
      registry.register(createTool('test_tool'))

      expect(() => registry.register(createTool('test_tool'))).toThrow(
        "Tool 'test_tool' already exists"
      )
    })

    it('should increment count after registration', () => {
      expect(registry.count).toBe(0)

      registry.register(createTool('tool1'))
      expect(registry.count).toBe(1)

      registry.register(createTool('tool2'))
      expect(registry.count).toBe(2)
    })
  })

  describe('get()', () => {
    it('should return tool by name', () => {
      const registered = registry.register(createTool('my_tool'))
      const tool = registry.get('my_tool')

      expect(tool).toEqual(registered)
    })

    it('should return undefined for non-existent tool', () => {
      const tool = registry.get('nonexistent')

      expect(tool).toBeUndefined()
    })
  })

  describe('getAll()', () => {
    it('should return empty array when no tools', () => {
      const tools = registry.getAll()

      expect(tools).toEqual([])
    })

    it('should return all tools', () => {
      registry.register(createTool('tool1'))
      registry.register(createTool('tool2'))

      const tools = registry.getAll()

      expect(tools).toHaveLength(2)
      expect(tools.map(t => t.name)).toContain('tool1')
      expect(tools.map(t => t.name)).toContain('tool2')
    })
  })

  describe('list()', () => {
    it('should return paginated list', () => {
      for (let i = 1; i <= 25; i++) {
        registry.register(createTool(`tool_${i.toString().padStart(2, '0')}`))
      }

      const result = registry.list({ page: 1, pageSize: 10 })

      expect(result.tools).toHaveLength(10)
      expect(result.total).toBe(25)
    })

    it('should filter by status', () => {
      registry.register(createTool('enabled_tool'))
      registry.register(createTool('disabled_tool'))
      registry.toggleStatus('disabled_tool')

      const result = registry.list({ status: 'enabled' })

      expect(result.tools).toHaveLength(1)
      expect(result.tools[0].name).toBe('enabled_tool')
    })

    it('should search by name', () => {
      registry.register(createTool('weather_query'))
      registry.register(createTool('send_message'))

      const result = registry.list({ search: 'weather' })

      expect(result.tools).toHaveLength(1)
      expect(result.tools[0].name).toBe('weather_query')
    })
  })

  describe('update()', () => {
    it('should update tool description', () => {
      registry.register(createTool('test_tool'))

      const updated = registry.update('test_tool', {
        description: 'New description',
      })

      expect(updated.description).toBe('New description')
      expect(updated.updatedAt).toBeGreaterThan(updated.createdAt)
    })

    it('should update tool inputSchema', () => {
      registry.register(createTool('test_tool'))

      const newSchema = {
        type: 'object' as const,
        properties: { newField: { type: 'number' } },
      }

      const updated = registry.update('test_tool', {
        inputSchema: newSchema,
      })

      expect(updated.inputSchema).toEqual(newSchema)
    })

    it('should update tool handler', () => {
      registry.register(createTool('test_tool'))

      const updated = registry.update('test_tool', {
        handler: { type: 'websocket', timeout: 60000 },
      })

      expect((updated.handler as any).timeout).toBe(60000)
    })

    it('should throw error for non-existent tool', () => {
      expect(() => registry.update('nonexistent', { description: 'test' })).toThrow(
        "Tool 'nonexistent' not found"
      )
    })

    it('should preserve existing fields when partial update', () => {
      const original = registry.register(createTool('test_tool'))
      const originalSchema = original.inputSchema

      registry.update('test_tool', { description: 'Updated' })

      const tool = registry.get('test_tool')
      expect(tool?.inputSchema).toEqual(originalSchema)
    })
  })

  describe('delete()', () => {
    it('should delete existing tool', () => {
      registry.register(createTool('test_tool'))

      const result = registry.delete('test_tool')

      expect(result).toBe(true)
      expect(registry.count).toBe(0)
      expect(registry.get('test_tool')).toBeUndefined()
    })

    it('should return false for non-existent tool', () => {
      const result = registry.delete('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('has()', () => {
    it('should return true for existing tool', () => {
      registry.register(createTool('test_tool'))

      expect(registry.has('test_tool')).toBe(true)
    })

    it('should return false for non-existent tool', () => {
      expect(registry.has('nonexistent')).toBe(false)
    })
  })

  describe('count', () => {
    it('should return 0 initially', () => {
      expect(registry.count).toBe(0)
    })

    it('should reflect number of tools', () => {
      registry.register(createTool('tool1'))
      registry.register(createTool('tool2'))
      expect(registry.count).toBe(2)

      registry.delete('tool1')
      expect(registry.count).toBe(1)
    })
  })

  describe('toggleStatus()', () => {
    it('should toggle tool status from enabled to disabled', () => {
      registry.register(createTool('test_tool'))

      const tool = registry.toggleStatus('test_tool')

      expect(tool.status).toBe('disabled')
    })

    it('should toggle tool status from disabled to enabled', () => {
      registry.register(createTool('test_tool'))
      registry.toggleStatus('test_tool')

      const tool = registry.toggleStatus('test_tool')

      expect(tool.status).toBe('enabled')
    })

    it('should throw error for non-existent tool', () => {
      expect(() => registry.toggleStatus('nonexistent')).toThrow(
        "Tool 'nonexistent' not found"
      )
    })
  })

  describe('generateMCPConfig()', () => {
    it('should generate valid MCP config', () => {
      registry.register(createTool('tool1'))
      registry.register(createTool('tool2'))

      const config = registry.generateMCPConfig()

      expect(config.serverName).toBe('test-bridge')
      expect(config.serverUrl).toBe('http://localhost:3000')
      expect(config.sseEndpoint).toBe('http://localhost:3000/sse')
      expect(config.claudeConfig.mcpServers['test-bridge'].url).toBe(
        'http://localhost:3000/sse'
      )
      expect(config.tools).toContain('tool1')
      expect(config.tools).toContain('tool2')
    })

    it('should only include enabled tools in MCP config', () => {
      registry.register(createTool('enabled_tool'))
      registry.register(createTool('disabled_tool'))
      registry.toggleStatus('disabled_tool')

      const config = registry.generateMCPConfig()

      expect(config.tools).toContain('enabled_tool')
      expect(config.tools).not.toContain('disabled_tool')
    })

    it('should include createdAt timestamp', () => {
      const config = registry.generateMCPConfig()

      expect(config.createdAt).toBeDefined()
      expect(new Date(config.createdAt).toISOString()).toBe(config.createdAt)
    })
  })
})