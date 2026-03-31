import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ToolExecutor } from './executor'
import { ToolRegistry } from './registry'
import type { WSClient } from './types'

describe('ToolExecutor', () => {
  let registry: ToolRegistry
  let executor: ToolExecutor
  let mockClientManager: { getClientsWithCapability: ReturnType<typeof vi.fn> }
  let mockWs: { send: ReturnType<typeof vi.fn>; readyState: number; close: ReturnType<typeof vi.fn> }

  const createMockClient = (id: string, capabilities: string[] = []): WSClient => ({
    id,
    ws: mockWs as unknown as WebSocket,
    capabilities: new Set(capabilities),
    subscriptions: new Set(),
    registeredAt: Date.now(),
    lastPingAt: Date.now(),
  })

  const registerTool = (name: string, handler: { type: 'websocket'; timeout?: number; target?: 'all' | 'first' | 'specific'; clientId?: string } = { type: 'websocket' }) => {
    registry.register({
      name,
      description: `Tool ${name}`,
      inputSchema: { type: 'object', properties: {} },
      handler: handler as any,
    })
  }

  beforeEach(() => {
    registry = new ToolRegistry()
    mockClientManager = {
      getClientsWithCapability: vi.fn(),
    }
    executor = new ToolExecutor(registry, mockClientManager)
    mockWs = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
      close: vi.fn(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('execute()', () => {
    it('should return UNKNOWN_TOOL when tool not found', async () => {
      const result = await executor.execute('nonexistent', {})

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('UNKNOWN_TOOL')
      expect(result.error?.message).toContain("Tool 'nonexistent' not found")
    })

    it('should return error for non-websocket handler type', async () => {
      registry.register({
        name: 'http_tool',
        description: 'HTTP tool',
        inputSchema: { type: 'object', properties: {} },
        handler: { type: 'http' as unknown as 'websocket' },
      })

      const result = await executor.execute('http_tool', {})

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('EXECUTION_FAILED')
      expect(result.error?.message).toContain('Unknown handler type')
    })
  })

  describe('executeWebSocket()', () => {
    it('should return CLIENT_OFFLINE when no clients available', async () => {
      registerTool('test_tool')
      mockClientManager.getClientsWithCapability.mockReturnValue([])

      const result = await executor.execute('test_tool', {})

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('CLIENT_OFFLINE')
    })

    it('should send tool_request to client', async () => {
      registerTool('test_tool')
      const client = createMockClient('client1', ['test_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client])

      // Start execution but don't await (will timeout)
      const executePromise = executor.execute('test_tool', { arg1: 'value1' })

      // Verify request was sent
      expect(mockWs.send).toHaveBeenCalledTimes(1)
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('tool_request')
      expect(sentData.tool).toBe('test_tool')
      expect(sentData.arguments).toEqual({ arg1: 'value1' })
      expect(sentData.requestId).toBeDefined()
      expect(sentData.timeout).toBe(30000)

      // Wait for timeout to complete
      await executePromise.catch(() => {})
    })

    it('should use custom timeout from handler', async () => {
      registerTool('slow_tool', { type: 'websocket', timeout: 5000 })
      const client = createMockClient('client1', ['slow_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client])

      const executePromise = executor.execute('slow_tool', {})

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.timeout).toBe(5000)

      await executePromise.catch(() => {})
    })

    it('should send to all clients by default (target: all)', async () => {
      registerTool('broadcast_tool')
      const client1 = createMockClient('client1', ['broadcast_tool'])
      const client2 = createMockClient('client2', ['broadcast_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client1, client2])

      const executePromise = executor.execute('broadcast_tool', {})

      // Should send to both clients
      expect(mockWs.send).toHaveBeenCalledTimes(2)

      await executePromise.catch(() => {})
    })

    it('should send to first client only (target: first)', async () => {
      registerTool('first_tool', { type: 'websocket', target: 'first' })
      const client1 = createMockClient('client1', ['first_tool'])
      const client2 = createMockClient('client2', ['first_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client1, client2])

      const executePromise = executor.execute('first_tool', {})

      // Should send only once (to first client)
      expect(mockWs.send).toHaveBeenCalledTimes(1)

      await executePromise.catch(() => {})
    })

    it('should send to specific client (target: specific)', async () => {
      registerTool('specific_tool', { type: 'websocket', target: 'specific', clientId: 'target_client' })
      const client1 = createMockClient('client1', ['specific_tool'])
      const client2 = createMockClient('target_client', ['specific_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client1, client2])

      const executePromise = executor.execute('specific_tool', {})

      // Should send only once (to specific client)
      expect(mockWs.send).toHaveBeenCalledTimes(1)
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.tool).toBe('specific_tool')

      await executePromise.catch(() => {})
    })

    it('should return error when specific client not found', async () => {
      registerTool('specific_tool', { type: 'websocket', target: 'specific', clientId: 'missing_client' })
      const client1 = createMockClient('client1', ['specific_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client1])

      const result = await executor.execute('specific_tool', {})

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('CLIENT_OFFLINE')
      expect(result.error?.message).toContain("Client 'missing_client' not found")
    })

    it('should return TIMEOUT when response not received', async () => {
      registerTool('timeout_tool', { type: 'websocket', timeout: 100 }) // 100ms timeout
      const client = createMockClient('client1', ['timeout_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client])

      const result = await executor.execute('timeout_tool', {})

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('TIMEOUT')
    })
  })

  describe('handleResponse()', () => {
    it('should resolve with result on success response', async () => {
      registerTool('test_tool')
      const client = createMockClient('client1', ['test_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client])

      const executePromise = executor.execute('test_tool', { input: 'test' })

      // Get the requestId from sent message
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])

      // Simulate response
      executor.handleResponse({
        requestId: sentData.requestId,
        success: true,
        result: { message: 'success' },
      })

      const result = await executePromise

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ message: 'success' })
    })

    it('should reject with error on failure response', async () => {
      registerTool('test_tool')
      const client = createMockClient('client1', ['test_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client])

      const executePromise = executor.execute('test_tool', {})

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])

      executor.handleResponse({
        requestId: sentData.requestId,
        success: false,
        error: { message: 'Execution failed' },
      })

      const result = await executePromise

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('EXECUTION_FAILED')
      expect(result.error?.message).toBe('Execution failed')
    })

    it('should ignore response with unknown requestId', async () => {
      // This should not throw or cause issues
      executor.handleResponse({
        requestId: 'unknown-request-id',
        success: true,
        result: { data: 'test' },
      })

      // No error means the test passes
      expect(true).toBe(true)
    })
  })

  describe('pendingCount', () => {
    it('should return 0 initially', () => {
      expect(executor.pendingCount).toBe(0)
    })

    it('should reflect pending requests', async () => {
      registerTool('test_tool', { type: 'websocket', timeout: 1000 })
      const client = createMockClient('client1', ['test_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client])

      executor.execute('test_tool', {})

      expect(executor.pendingCount).toBe(1)

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100))

      expect(executor.pendingCount).toBe(0)
    })
  })

  describe('getPendingRequests()', () => {
    it('should return empty array initially', () => {
      expect(executor.getPendingRequests()).toEqual([])
    })

    it('should return pending requests', async () => {
      registerTool('test_tool', { type: 'websocket', timeout: 1000 })
      const client = createMockClient('client1', ['test_tool'])
      mockClientManager.getClientsWithCapability.mockReturnValue([client])

      executor.execute('test_tool', { arg: 'value' })

      const pending = executor.getPendingRequests()
      expect(pending).toHaveLength(1)
      expect(pending[0].toolName).toBe('test_tool')
      expect(pending[0].arguments).toEqual({ arg: 'value' })

      // Wait for timeout to clean up
      await new Promise(resolve => setTimeout(resolve, 1100))
    })
  })
})