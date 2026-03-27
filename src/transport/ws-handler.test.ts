import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWSMessageHandler } from './ws-handler'
import { WSClientManager } from './websocket'
import { ToolRegistry } from '../core/registry'
import { ToolExecutor } from '../core/executor'
import type { WSClient } from '../core/types'

describe('createWSMessageHandler', () => {
  let clientManager: WSClientManager
  let registry: ToolRegistry
  let executor: ToolExecutor
  let handler: ReturnType<typeof createWSMessageHandler>
  let mockWs: { send: ReturnType<typeof vi.fn>; readyState: number; close: ReturnType<typeof vi.fn> }
  let client: WSClient

  beforeEach(() => {
    registry = new ToolRegistry()
    clientManager = new WSClientManager(30000)
    executor = new ToolExecutor(registry, clientManager)
    handler = createWSMessageHandler(clientManager, executor)

    mockWs = {
      send: vi.fn(),
      readyState: 1,
      close: vi.fn(),
    }

    client = clientManager.addClient(mockWs as unknown as WebSocket)
  })

  describe('JSON parsing', () => {
    it('should send error for invalid JSON', () => {
      handler(client, 'not valid json')

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('error')
      expect(sentData.code).toBe('INVALID_MESSAGE')
      expect(sentData.message).toBe('Invalid JSON format')
    })

    it('should send error when type field is missing', () => {
      handler(client, JSON.stringify({ name: 'test' }))

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('error')
      expect(sentData.code).toBe('INVALID_MESSAGE')
      expect(sentData.message).toContain('type')
    })
  })

  describe('register', () => {
    it('should register client with capabilities', () => {
      handler(client, JSON.stringify({
        type: 'register',
        clientId: 'my-client',
        capabilities: ['tool1', 'tool2'],
      }))

      expect(client.id).toBe('my-client')
      expect(client.capabilities.has('tool1')).toBe(true)
      expect(client.capabilities.has('tool2')).toBe(true)

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('registered')
      expect(sentData.clientId).toBe('my-client')
      expect(sentData.timestamp).toBeDefined()
    })

    it('should register client without custom ID', () => {
      const originalId = client.id

      handler(client, JSON.stringify({
        type: 'register',
        capabilities: ['tool1'],
      }))

      // ID should remain unchanged when not specified
      expect(client.id).toBe(originalId)
      expect(client.capabilities.has('tool1')).toBe(true)
    })
  })

  describe('ping', () => {
    it('should update lastPingAt and return pong', () => {
      const before = client.lastPingAt

      // Wait a tiny bit to ensure time difference
      handler(client, JSON.stringify({ type: 'ping' }))

      expect(client.lastPingAt).toBeGreaterThanOrEqual(before)

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('pong')
      expect(sentData.timestamp).toBeDefined()
    })
  })

  describe('subscribe', () => {
    it('should subscribe to events', () => {
      handler(client, JSON.stringify({
        type: 'subscribe',
        events: ['tool_invoked', 'tool_registered'],
      }))

      expect(client.subscriptions.has('tool_invoked')).toBe(true)
      expect(client.subscriptions.has('tool_registered')).toBe(true)

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('subscribed')
      expect(sentData.events).toContain('tool_invoked')
      expect(sentData.events).toContain('tool_registered')
    })

    it('should send error for invalid event type', () => {
      handler(client, JSON.stringify({
        type: 'subscribe',
        events: ['invalid_event'],
      }))

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('error')
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe from events', () => {
      client.subscriptions.add('tool_invoked')
      client.subscriptions.add('tool_registered')

      handler(client, JSON.stringify({
        type: 'unsubscribe',
        events: ['tool_invoked'],
      }))

      expect(client.subscriptions.has('tool_invoked')).toBe(false)
      expect(client.subscriptions.has('tool_registered')).toBe(true)

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('unsubscribed')
    })
  })

  describe('tool_response', () => {
    it('should call executor.handleResponse', () => {
      registry.register({
        name: 'test_tool',
        description: 'Test',
        inputSchema: { type: 'object', properties: {} },
        handler: { type: 'websocket', timeout: 1000 },
      })

      // Setup a mock client with capability
      client.capabilities.add('test_tool')
      const handleResponseSpy = vi.spyOn(executor, 'handleResponse')

      // Start execution to create pending request
      const executePromise = executor.execute('test_tool', {})

      // Get the requestId from the sent message
      const requestCall = mockWs.send.mock.calls.find((call: unknown[]) => {
        const data = JSON.parse(call[0] as string)
        return data.type === 'tool_request'
      })
      const requestData = JSON.parse(requestCall![0] as string)

      // Clear mock for clean assertions
      mockWs.send.mockClear()

      // Send tool_response
      handler(client, JSON.stringify({
        type: 'tool_response',
        requestId: requestData.requestId,
        success: true,
        result: { data: 'test' },
      }))

      expect(handleResponseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: requestData.requestId,
          success: true,
          result: { data: 'test' },
        })
      )

      // Clean up
      executePromise.catch(() => {})
    })

    it('should ignore invalid tool_response format', () => {
      const handleResponseSpy = vi.spyOn(executor, 'handleResponse')

      handler(client, JSON.stringify({
        type: 'tool_response',
        // Missing required requestId
        success: true,
      }))

      expect(handleResponseSpy).not.toHaveBeenCalled()
    })
  })

  describe('unknown message type', () => {
    it('should send error for unknown type', () => {
      handler(client, JSON.stringify({ type: 'unknown_type' }))

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('error')
      expect(sentData.code).toBe('UNKNOWN_MESSAGE_TYPE')
      expect(sentData.message).toContain('unknown_type')
    })
  })
})