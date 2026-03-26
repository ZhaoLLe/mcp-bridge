/**
 * MCP SSE Server
 * 通过 SSE (Server-Sent Events) 提供 MCP 协议支持
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import type { ToolRegistry } from '../core/registry'
import type { ToolExecutor } from '../core/executor'
import { randomUUID } from 'crypto'

/**
 * 创建 SSE 路由
 */
export function createSSERoute(
  registry: ToolRegistry,
  executor: ToolExecutor
) {
  const app = new Hono()
  const transports: Map<string, SSEServerTransport> = new Map()

  // SSE 端点 - GET 请求建立 SSE 连接
  app.get('/', async (c) => {
    const sessionId = randomUUID()

    // 创建 MCP Server 实例
    const server = new Server(
      { name: 'mcp-bridge', version: '1.0.0' },
      { capabilities: { tools: {} } }
    )

    // 列出工具
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = registry.getAll()
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      }
    })

    // 调用工具
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params
      const result = await executor.execute(name, args || {})

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.result, null, 2)
            }
          ]
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${result.error?.message}`
            }
          ],
          isError: true
        }
      }
    })

    // 使用 SSE stream
    return streamSSE(c, async (stream) => {
      // 创建 SSE transport
      const transport = new SSEServerTransport('/sse/message', stream)
      transports.set(sessionId, transport)

      // 连接 server 和 transport
      await server.connect(transport)

      // 发送 endpoint 事件
      await stream.writeSSE({
        event: 'endpoint',
        data: JSON.stringify({
          endpoint: `/sse/message?sessionId=${sessionId}`,
          sessionId
        })
      })

      // 保持连接（transport 会处理消息）
      // 当客户端断开时，stream 会自动关闭
    })
  })

  // MCP 消息端点 - POST 请求处理客户端消息
  app.post('/message', async (c) => {
    const sessionId = c.req.query('sessionId')
    if (!sessionId) {
      return c.json({ error: 'Missing sessionId' }, 400)
    }

    const transport = transports.get(sessionId)
    if (!transport) {
      return c.json({ error: 'Session not found' }, 404)
    }

    try {
      const body = await c.req.json()
      await transport.handlePostMessage(c.req.raw, body)
      return c.json({ received: true })
    } catch (error) {
      console.error('Error handling message:', error)
      return c.json({ error: 'Failed to handle message' }, 500)
    }
  })

  return app
}