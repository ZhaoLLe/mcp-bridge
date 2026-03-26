/**
 * WebSocket Hook
 */

import { useEffect, useState, useCallback, useRef } from 'react'

interface UseWebSocketOptions {
  url: string
}

interface ToolRequest {
  requestId: string
  tool: string
  action?: string
  arguments: Record<string, unknown>
  timeout: number
}

export function useWebSocket({ url }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [toolRequests, setToolRequests] = useState<ToolRequest[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const requestCallbacksRef = useRef<Map<string, (request: ToolRequest) => void>>(new Map())

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      // 自动注册
      ws.send(JSON.stringify({
        type: 'register',
        capabilities: ['*'] // 注册所有能力
      }))
    }

    ws.onclose = () => {
      setConnected(false)
      setClientId(null)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        switch (message.type) {
          case 'registered':
            setClientId(message.clientId)
            break

          case 'pong':
            // 心跳响应
            break

          case 'tool_request':
            setToolRequests(prev => [...prev, {
              requestId: message.requestId,
              tool: message.tool,
              action: message.action,
              arguments: message.arguments,
              timeout: message.timeout
            }])
            // 触发回调
            const callback = requestCallbacksRef.current.get('tool_request')
            if (callback) {
              callback({
                requestId: message.requestId,
                tool: message.tool,
                action: message.action,
                arguments: message.arguments,
                timeout: message.timeout
              })
            }
            break
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    return () => {
      ws.close()
    }
  }, [url])

  const respond = useCallback((requestId: string, success: boolean, result?: unknown, error?: { code: string; message: string }) => {
    if (!wsRef.current) return

    wsRef.current.send(JSON.stringify({
      type: 'tool_response',
      requestId,
      success,
      result,
      error
    }))

    // 移除已处理的请求
    setToolRequests(prev => prev.filter(r => r.requestId !== requestId))
  }, [])

  const onToolRequest = useCallback((callback: (request: ToolRequest) => void) => {
    requestCallbacksRef.current.set('tool_request', callback)
    return () => {
      requestCallbacksRef.current.delete('tool_request')
    }
  }, [])

  const subscribe = useCallback((events: string[]) => {
    if (!wsRef.current) return
    wsRef.current.send(JSON.stringify({
      type: 'subscribe',
      events
    }))
  }, [])

  return {
    connected,
    clientId,
    toolRequests,
    respond,
    onToolRequest,
    subscribe
  }
}