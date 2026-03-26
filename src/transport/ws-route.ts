/**
 * WebSocket 路由（Hono 集成）
 */

import { Hono } from 'hono'
import { createWSMessageHandler } from './ws-handler'
import type { WSClientManager } from './websocket'
import type { ToolExecutor } from '../core/executor'

export function createWSRoute(
  clientManager: WSClientManager,
  executor: ToolExecutor
) {
  const app = new Hono()

  app.get('/', (c) => {
    // 检查是否是 WebSocket 升级请求
    const upgradeHeader = c.req.header('upgrade')
    if (upgradeHeader !== 'websocket') {
      return c.json({ error: 'Expected WebSocket' }, 426)
    }

    // 使用 Hono 的 websocket 方法
    // @ts-ignore - Hono websocket 类型问题
    return c.websocket((ws) => {
      // 添加客户端
      const client = clientManager.addClient(ws as unknown as WebSocket)

      // 发送欢迎消息
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Please register with your capabilities',
        timestamp: new Date().toISOString()
      }))

      // 消息处理
      const handler = createWSMessageHandler(clientManager, executor)

      ws.addEventListener('message', (event) => {
        const data = typeof event.data === 'string' ? event.data : event.data.toString()
        handler(client, data)
      })

      // 关闭处理
      ws.addEventListener('close', () => {
        clientManager.removeClient(client.id)
      })

      // 错误处理
      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error)
        clientManager.removeClient(client.id)
      })
    })
  })

  return app
}