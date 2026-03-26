/**
 * WebSocket 消息处理器
 */

import type { WSClient, ErrorCode, WSToolRequestMessage } from '../core/types'
import type { WSClientManager } from './websocket'
import type { ToolExecutor } from '../core/executor'
import {
  WSRegisterSchema,
  WSSubscribeSchema,
  WSUnsubscribeSchema,
  WSToolResponseSchema
} from '../core/schemas'
import { z } from 'zod'

export function createWSMessageHandler(
  clientManager: WSClientManager,
  executor: ToolExecutor
) {
  return (client: WSClient, data: string) => {
    let message: { type: string; [key: string]: unknown }

    try {
      message = JSON.parse(data)
    } catch {
      clientManager.sendError(client.ws, 'INVALID_MESSAGE', 'Invalid JSON format')
      return
    }

    if (!message.type) {
      clientManager.sendError(client.ws, 'INVALID_MESSAGE', "Message must include 'type' field")
      return
    }

    switch (message.type) {
      case 'register':
        handleRegister(clientManager, client, message)
        break

      case 'ping':
        handlePing(clientManager, client)
        break

      case 'subscribe':
        handleSubscribe(clientManager, client, message)
        break

      case 'unsubscribe':
        handleUnsubscribe(clientManager, client, message)
        break

      case 'tool_response':
        handleToolResponse(executor, message)
        break

      default:
        clientManager.sendError(client.ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`)
    }
  }
}

function handleRegister(
  clientManager: WSClientManager,
  client: WSClient,
  message: unknown
): void {
  const result = WSRegisterSchema.safeParse(message)
  if (!result.success) {
    clientManager.sendError(client.ws, 'INVALID_MESSAGE', result.error.errors[0].message)
    return
  }

  const { clientId, capabilities } = result.data
  clientManager.registerClient(client, clientId, capabilities)

  client.ws.send(JSON.stringify({
    type: 'registered',
    clientId: client.id,
    timestamp: new Date().toISOString()
  }))
}

function handlePing(clientManager: WSClientManager, client: WSClient): void {
  client.lastPingAt = Date.now()
  client.ws.send(JSON.stringify({
    type: 'pong',
    timestamp: new Date().toISOString()
  }))
}

function handleSubscribe(
  clientManager: WSClientManager,
  client: WSClient,
  message: unknown
): void {
  const result = WSSubscribeSchema.safeParse(message)
  if (!result.success) {
    clientManager.sendError(client.ws, 'INVALID_MESSAGE', result.error.errors[0].message)
    return
  }

  clientManager.subscribe(client, result.data.events)
  client.ws.send(JSON.stringify({
    type: 'subscribed',
    events: result.data.events,
    timestamp: new Date().toISOString()
  }))
}

function handleUnsubscribe(
  clientManager: WSClientManager,
  client: WSClient,
  message: unknown
): void {
  const result = WSUnsubscribeSchema.safeParse(message)
  if (!result.success) {
    clientManager.sendError(client.ws, 'INVALID_MESSAGE', result.error.errors[0].message)
    return
  }

  clientManager.unsubscribe(client, result.data.events)
  client.ws.send(JSON.stringify({
    type: 'unsubscribed',
    events: result.data.events,
    timestamp: new Date().toISOString()
  }))
}

function handleToolResponse(
  executor: ToolExecutor,
  message: unknown
): void {
  console.log('[DEBUG] Received tool_response:', JSON.stringify(message))
  const result = WSToolResponseSchema.safeParse(message)
  if (!result.success) {
    console.error('[DEBUG] Validation failed:', result.error.errors)
    return // 无法处理的消息，忽略
  }

  console.log('[DEBUG] Validation passed, calling executor.handleResponse')
  executor.handleResponse(result.data)
}