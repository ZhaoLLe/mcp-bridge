import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WSClientManager } from './websocket'
import type { WSClient, EventType } from '../core/types'

describe('WSClientManager', () => {
  let manager: WSClientManager
  let mockWs: { send: ReturnType<typeof vi.fn>; readyState: number; close: ReturnType<typeof vi.fn> }

  const createMockWs = (): { send: ReturnType<typeof vi.fn>; readyState: number; close: ReturnType<typeof vi.fn> } => ({
    send: vi.fn(),
    readyState: 1, // WebSocket.OPEN
    close: vi.fn(),
  })

  beforeEach(() => {
    manager = new WSClientManager(30000)
    mockWs = createMockWs()
  })

  afterEach(() => {
    manager.stopHeartbeat()
    vi.clearAllMocks()
  })

  describe('addClient()', () => {
    it('should add client and generate ID', () => {
      const client = manager.addClient(mockWs as unknown as WebSocket)

      expect(client.id).toBeDefined()
      expect(client.ws).toBe(mockWs)
      expect(client.capabilities.size).toBe(0)
      expect(client.subscriptions.size).toBe(0)
      expect(manager.clientCount).toBe(1)
    })

    it('should emit client_connected event', () => {
      const handler = vi.fn()
      manager.on('client_connected', handler)

      const client = manager.addClient(mockWs as unknown as WebSocket)

      expect(handler).toHaveBeenCalledWith(client)
    })
  })

  describe('removeClient()', () => {
    it('should remove client', () => {
      const client = manager.addClient(mockWs as unknown as WebSocket)

      manager.removeClient(client.id)

      expect(manager.clientCount).toBe(0)
      expect(manager.getClient(client.id)).toBeUndefined()
    })

    it('should emit client_disconnected event', () => {
      const handler = vi.fn()
      manager.on('client_disconnected', handler)
      const client = manager.addClient(mockWs as unknown as WebSocket)

      manager.removeClient(client.id)

      expect(handler).toHaveBeenCalledWith(client)
    })

    it('should do nothing for non-existent client', () => {
      manager.removeClient('nonexistent')

      expect(manager.clientCount).toBe(0)
    })
  })

  describe('registerClient()', () => {
    it('should set capabilities', () => {
      const client = manager.addClient(mockWs as unknown as WebSocket)

      manager.registerClient(client, undefined, ['tool1', 'tool2'])

      expect(client.capabilities.has('tool1')).toBe(true)
      expect(client.capabilities.has('tool2')).toBe(true)
    })

    it('should update client ID', () => {
      const client = manager.addClient(mockWs as unknown as WebSocket)
      const oldId = client.id

      manager.registerClient(client, 'custom-id')

      expect(client.id).toBe('custom-id')
      expect(manager.getClient(oldId)).toBeUndefined()
      expect(manager.getClient('custom-id')).toBe(client)
    })

    it('should emit client_registered event', () => {
      const handler = vi.fn()
      manager.on('client_registered', handler)
      const client = manager.addClient(mockWs as unknown as WebSocket)

      manager.registerClient(client, 'custom-id', ['tool1'])

      expect(handler).toHaveBeenCalledWith(client)
    })
  })

  describe('getClient()', () => {
    it('should return client by ID', () => {
      const client = manager.addClient(mockWs as unknown as WebSocket)

      expect(manager.getClient(client.id)).toBe(client)
    })

    it('should return undefined for non-existent ID', () => {
      expect(manager.getClient('nonexistent')).toBeUndefined()
    })
  })

  describe('getAllClients()', () => {
    it('should return all clients', () => {
      const client1 = manager.addClient(createMockWs() as unknown as WebSocket)
      const client2 = manager.addClient(createMockWs() as unknown as WebSocket)

      const clients = manager.getAllClients()

      expect(clients).toHaveLength(2)
      expect(clients).toContain(client1)
      expect(clients).toContain(client2)
    })

    it('should return empty array when no clients', () => {
      expect(manager.getAllClients()).toEqual([])
    })
  })

  describe('getClientsWithCapability()', () => {
    it('should filter clients by capability', () => {
      const client1 = manager.addClient(createMockWs() as unknown as WebSocket)
      client1.capabilities.add('tool1')

      const client2 = manager.addClient(createMockWs() as unknown as WebSocket)
      client2.capabilities.add('tool2')

      const result = manager.getClientsWithCapability('tool1')

      expect(result).toHaveLength(1)
      expect(result[0]).toBe(client1)
    })

    it('should include clients with wildcard capability', () => {
      const client1 = manager.addClient(createMockWs() as unknown as WebSocket)
      client1.capabilities.add('*') // wildcard

      const result = manager.getClientsWithCapability('any_tool')

      expect(result).toHaveLength(1)
      expect(result[0]).toBe(client1)
    })

    it('should return empty array when no matching clients', () => {
      manager.addClient(createMockWs() as unknown as WebSocket)

      const result = manager.getClientsWithCapability('nonexistent_tool')

      expect(result).toEqual([])
    })
  })

  describe('subscribe() / unsubscribe()', () => {
    it('should add subscriptions', () => {
      const client = manager.addClient(mockWs as unknown as WebSocket)

      manager.subscribe(client, ['tool_invoked', 'tool_registered'])

      expect(client.subscriptions.has('tool_invoked')).toBe(true)
      expect(client.subscriptions.has('tool_registered')).toBe(true)
    })

    it('should remove subscriptions', () => {
      const client = manager.addClient(mockWs as unknown as WebSocket)
      client.subscriptions.add('tool_invoked')
      client.subscriptions.add('tool_registered')

      manager.unsubscribe(client, ['tool_invoked'])

      expect(client.subscriptions.has('tool_invoked')).toBe(false)
      expect(client.subscriptions.has('tool_registered')).toBe(true)
    })
  })

  describe('send()', () => {
    it('should send JSON message to open WebSocket', () => {
      manager.addClient(mockWs as unknown as WebSocket)

      manager.send(mockWs as unknown as WebSocket, 'test_type', { data: 'test' })

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('test_type')
      expect(sentData.data).toBe('test')
      expect(sentData.timestamp).toBeDefined()
    })

    it('should not send to non-open WebSocket', () => {
      mockWs.readyState = 0 // CONNECTING

      manager.send(mockWs as unknown as WebSocket, 'test', {})

      expect(mockWs.send).not.toHaveBeenCalled()
    })
  })

  describe('sendError()', () => {
    it('should send error message', () => {
      manager.addClient(mockWs as unknown as WebSocket)

      manager.sendError(mockWs as unknown as WebSocket, 'INVALID_MESSAGE', 'Test error')

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0])
      expect(sentData.type).toBe('error')
      expect(sentData.code).toBe('INVALID_MESSAGE')
      expect(sentData.message).toBe('Test error')
    })
  })

  describe('broadcast()', () => {
    it('should send to all open clients', () => {
      const ws1 = createMockWs()
      const ws2 = createMockWs()
      manager.addClient(ws1 as unknown as WebSocket)
      manager.addClient(ws2 as unknown as WebSocket)

      manager.broadcast('announcement', { message: 'hello' })

      expect(ws1.send).toHaveBeenCalledTimes(1)
      expect(ws2.send).toHaveBeenCalledTimes(1)

      const sentData = JSON.parse(ws1.send.mock.calls[0][0])
      expect(sentData.type).toBe('announcement')
    })

    it('should skip non-open clients', () => {
      const ws1 = createMockWs()
      const ws2 = createMockWs()
      ws2.readyState = 0 // CONNECTING
      manager.addClient(ws1 as unknown as WebSocket)
      manager.addClient(ws2 as unknown as WebSocket)

      manager.broadcast('test', {})

      expect(ws1.send).toHaveBeenCalledTimes(1)
      expect(ws2.send).not.toHaveBeenCalled()
    })
  })

  describe('broadcastEvent()', () => {
    it('should send only to subscribed clients', () => {
      const ws1 = createMockWs()
      const ws2 = createMockWs()
      const client1 = manager.addClient(ws1 as unknown as WebSocket)
      const client2 = manager.addClient(ws2 as unknown as WebSocket)

      client1.subscriptions.add('tool_invoked' as EventType)
      // client2 not subscribed

      manager.broadcastEvent('tool_invoked', { tool: 'test' })

      expect(ws1.send).toHaveBeenCalledTimes(1)
      expect(ws2.send).not.toHaveBeenCalled()
    })
  })

  describe('heartbeat', () => {
    it('should start heartbeat detection', () => {
      manager.startHeartbeat()

      // Check that interval is set
      expect((manager as unknown as { heartbeatInterval: unknown }).heartbeatInterval).not.toBeNull()

      manager.stopHeartbeat()
    })

    it('should stop heartbeat detection', () => {
      manager.startHeartbeat()
      manager.stopHeartbeat()

      expect((manager as unknown as { heartbeatInterval: unknown }).heartbeatInterval).toBeNull()
    })

    it('should remove clients that exceed heartbeat timeout', async () => {
      // Use very short heartbeat for testing
      manager.stopHeartbeat()
      manager = new WSClientManager(10) // 10ms heartbeat
      const client = manager.addClient(mockWs as unknown as WebSocket)

      // Set lastPingAt to old time (simulate timeout)
      client.lastPingAt = Date.now() - 1000

      manager.startHeartbeat()

      // Wait for heartbeat to run
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(manager.clientCount).toBe(0)
      expect(mockWs.close).toHaveBeenCalled()

      manager.stopHeartbeat()
    })
  })

  describe('clientCount', () => {
    it('should return correct count', () => {
      expect(manager.clientCount).toBe(0)

      manager.addClient(createMockWs() as unknown as WebSocket)
      expect(manager.clientCount).toBe(1)

      manager.addClient(createMockWs() as unknown as WebSocket)
      expect(manager.clientCount).toBe(2)

      const clients = manager.getAllClients()
      manager.removeClient(clients[0].id)
      expect(manager.clientCount).toBe(1)
    })
  })
})