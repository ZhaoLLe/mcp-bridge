/**
 * MCP Bridge 服务入口
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { serve } from '@hono/node-server'
import { EventEmitter } from 'events'
import { ToolRegistry } from './core/registry'
import { ToolExecutor } from './core/executor'
import { WSClientManager } from './transport/websocket'
import { createToolsRoutes } from './api/tools'
import { createSSERoute } from './transport/sse'
import { config } from './config'
import { WebSocketServer } from 'ws'
import { createWSMessageHandler } from './transport/ws-handler'

async function main() {
  // 初始化核心组件
  const registry = new ToolRegistry(config.serverUrl, config.mcp.name)
  const clientManager = new WSClientManager(config.websocket.heartbeat)
  const executor = new ToolExecutor(registry, clientManager)
  const eventEmitter = new EventEmitter()

  // 事件广播
  eventEmitter.on('tool_invoked', (data) => {
    clientManager.broadcastEvent('tool_invoked', data)
  })
  eventEmitter.on('tool_registered', (data) => {
    clientManager.broadcastEvent('tool_registered', data)
  })
  eventEmitter.on('tool_updated', (data) => {
    clientManager.broadcastEvent('tool_updated', data)
  })
  eventEmitter.on('tool_deleted', (data) => {
    clientManager.broadcastEvent('tool_deleted', data)
  })

  // 创建 Hono 应用
  const app = new Hono()

  // CORS
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  }))

  // API 路由
  app.route('/api/tools', createToolsRoutes(registry, executor, eventEmitter))

  // SSE MCP 路由
  app.route('/sse', createSSERoute(registry, executor))

  // 健康检查
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // 根路由
  app.get('/', (c) => c.json({
    name: 'MCP Bridge',
    version: '1.0.0',
    endpoints: {
      api: '/api/tools',
      websocket: '/ws',
      sse: '/sse',
      health: '/health'
    }
  }))

  // SDK 静态文件
  app.use('/sdk/*', serveStatic({ root: './' }))

  // 启动心跳检测
  clientManager.startHeartbeat()

  // 启动 HTTP 服务器
  console.log(`MCP Bridge server starting on ${config.serverUrl}`)
  console.log(`  - HTTP API: ${config.serverUrl}/api/tools`)
  console.log(`  - WebSocket: ${config.serverUrl}/ws`)
  console.log(`  - MCP SSE: ${config.serverUrl}/sse`)
  console.log(`  - Health: ${config.serverUrl}/health`)

  const server = serve({
    fetch: app.fetch,
    port: config.port
  })

  // WebSocket 服务器
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws) => {
    // 添加客户端
    const client = clientManager.addClient(ws)

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Please register with your capabilities',
      timestamp: new Date().toISOString()
    }))

    // 消息处理
    const handler = createWSMessageHandler(clientManager, executor)

    ws.on('message', (data) => {
      handler(client, data.toString())
    })

    ws.on('close', () => {
      clientManager.removeClient(client.id)
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
      clientManager.removeClient(client.id)
    })
  })

  console.log('Server started successfully!')
}

main().catch(console.error)