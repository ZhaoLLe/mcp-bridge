/**
 * WebSocket 客户端管理器
 */

import type { WSClient, EventType, ErrorCode, WSToolRequestMessage } from '../core/types'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'

export class WSClientManager extends EventEmitter implements import('../core/executor').IWSClientManager {
  private clients: Map<string, WSClient> = new Map()
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  constructor(private heartbeatMs: number = 30000) {
    super()
  }

  /**
   * 添加客户端
   */
  addClient(ws: WebSocket): WSClient {
    const id = randomUUID()
    const client: WSClient = {
      id,
      ws,
      capabilities: new Set(),
      subscriptions: new Set(),
      registeredAt: Date.now(),
      lastPingAt: Date.now()
    }

    this.clients.set(id, client)
    this.emit('client_connected', client)

    return client
  }

  /**
   * 移除客户端
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId)
    if (client) {
      this.clients.delete(clientId)
      this.emit('client_disconnected', client)
    }
  }

  /**
   * 注册客户端
   */
  registerClient(client: WSClient, clientId?: string, capabilities?: string[]): void {
    if (clientId) {
      // 使用自定义 ID
      this.clients.delete(client.id)
      client.id = clientId
      this.clients.set(clientId, client)
    }

    if (capabilities) {
      client.capabilities = new Set(capabilities)
    }

    this.emit('client_registered', client)
  }

  /**
   * 获取客户端
   */
  getClient(clientId: string): WSClient | undefined {
    return this.clients.get(clientId)
  }

  /**
   * 获取所有客户端
   */
  getAllClients(): WSClient[] {
    return Array.from(this.clients.values())
  }

  /**
   * 获取具有指定能力的客户端
   */
  getClientsWithCapability(capability: string): WSClient[] {
    return this.getAllClients().filter(c =>
      c.capabilities.has(capability) || c.capabilities.has('*')
    )
  }

  /**
   * 订阅事件
   */
  subscribe(client: WSClient, events: EventType[]): void {
    for (const event of events) {
      client.subscriptions.add(event)
    }
  }

  /**
   * 取消订阅
   */
  unsubscribe(client: WSClient, events: EventType[]): void {
    for (const event of events) {
      client.subscriptions.delete(event)
    }
  }

  /**
   * 发送消息
   */
  send(ws: WebSocket, type: string, data?: unknown): void {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify({ type, ...data, timestamp: new Date().toISOString() }))
    }
  }

  /**
   * 发送错误消息
   */
  sendError(ws: WebSocket, code: ErrorCode, message: string): void {
    this.send(ws, 'error', { code, message })
  }

  /**
   * 广播消息给所有客户端
   */
  broadcast(type: string, data?: unknown): void {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() })
    for (const client of this.clients.values()) {
      if (client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.send(message)
      }
    }
  }

  /**
   * 广播事件给订阅的客户端
   */
  broadcastEvent(eventType: EventType, data: unknown): void {
    const message = JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() })
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(eventType) && client.ws.readyState === 1) {
        client.ws.send(message)
      }
    }
  }

  /**
   * 发送工具执行请求
   */
  sendToolRequest(ws: WebSocket, request: WSToolRequestMessage): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(request))
    }
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat(): void {
    if (this.heartbeatInterval) return

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      for (const client of this.clients.values()) {
        // 检查客户端是否超时（3 倍心跳时间未收到 ping）
        if (now - client.lastPingAt > this.heartbeatMs * 3) {
          this.removeClient(client.id)
          client.ws.close()
        }
      }
    }, this.heartbeatMs)
  }

  /**
   * 停止心跳检测
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * 获取客户端数量
   */
  get clientCount(): number {
    return this.clients.size
  }
}