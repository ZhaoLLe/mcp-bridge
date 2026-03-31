/**
 * MCP Bridge 服务入口
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { serve } from '@hono/node-server'
import { EventEmitter } from 'events'
import { readFile } from 'fs/promises'
import { ToolRegistry } from './core/registry'
import { ToolExecutor } from './core/executor'
import { SkillRegistry } from './core/skillRegistry'
import { SkillExecutor } from './core/skillExecutor'
import { SkillMdGenerator } from './core/skillMdGenerator'
import { InvokeLogStore } from './core/invokeLogStore'
import { WSClientManager } from './transport/websocket'
import { createToolsRoutes } from './api/tools'
import { createSkillsRoutes } from './api/skills'
import { createLogsRoutes } from './api/logs'
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

  // 初始化 Skill 相关组件
  const skillRegistry = new SkillRegistry()
  const invokeLogStore = new InvokeLogStore()
  const skillExecutor = new SkillExecutor(skillRegistry, executor)

  // 将 SkillExecutor 注入到 ToolExecutor（用于 skill handler 类型）
  executor.setSkillExecutor(skillExecutor)

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

  // Skill 事件广播
  eventEmitter.on('skill_invoked', (data) => {
    clientManager.broadcastEvent('skill_invoked', data)
  })
  eventEmitter.on('skill_registered', (data) => {
    clientManager.broadcastEvent('skill_registered', data)
  })
  eventEmitter.on('skill_updated', (data) => {
    clientManager.broadcastEvent('skill_updated', data)
  })
  eventEmitter.on('skill_deleted', (data) => {
    clientManager.broadcastEvent('skill_deleted', data)
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
  app.route('/api/tools', createToolsRoutes(registry, executor, eventEmitter, skillRegistry))
  app.route('/api/skills', createSkillsRoutes(skillRegistry, skillExecutor, invokeLogStore, eventEmitter, registry))
  app.route('/api/logs', createLogsRoutes(invokeLogStore))

  // SSE MCP 路由
  app.route('/sse', createSSERoute(registry, executor))

  // 健康检查
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // API 信息
  app.get('/api', (c) => c.json({
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

  // Web UI 静态文件（生产环境）- 禁用缓存
  app.use('/assets/*', serveStatic({ root: './dist/web/assets', rewriteRequestHeaders: () => ({
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  })}))

  // 根路径
  app.get('/', async (c) => {
    const html = await readFile('./dist/web/index.html', 'utf-8')
    return c.body(html, 200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    })
  })

  // SPA 回退：所有其他非 API 路由返回 index.html
  // 注意：静态路由必须在通配符路由之前
  app.get('/skills/new', async (c) => {
    const html = await readFile('./dist/web/index.html', 'utf-8')
    return c.body(html, 200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    })
  })
  app.get('/skills/editor/*', async (c) => {
    const html = await readFile('./dist/web/index.html', 'utf-8')
    return c.body(html, 200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    })
  })
  app.get('/skills/*', async (c) => {
    const html = await readFile('./dist/web/index.html', 'utf-8')
    return c.body(html, 200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    })
  })
  app.get('/tools/*', async (c) => {
    const html = await readFile('./dist/web/index.html', 'utf-8')
    return c.body(html, 200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    })
  })
  app.get('/logs/*', async (c) => {
    const html = await readFile('./dist/web/index.html', 'utf-8')
    return c.body(html, 200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    })
  })

  // 其他静态文件
  app.use('/*', serveStatic({ root: './dist/web' }))

  // 启动心跳检测
  clientManager.startHeartbeat()

  // 启动 HTTP 服务器
  console.log(`MCP Bridge server starting on ${config.serverUrl}`)
  console.log(`  - HTTP API: ${config.serverUrl}/api/tools`)
  console.log(`  - Skills API: ${config.serverUrl}/api/skills`)
  console.log(`  - Logs API: ${config.serverUrl}/api/logs`)
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

  // 初始化示例工具（如果为空）
  await initializeSampleTools(registry, eventEmitter)

  // 初始化示例 Skill（如果为空）
  await initializeSampleSkills(skillRegistry, eventEmitter)
}

/**
 * 初始化示例 HTTP 工具
 */
async function initializeSampleTools(
  registry: import('./core/registry').ToolRegistry,
  eventEmitter: EventEmitter
) {
  const sampleTools = [
    {
      name: 'jsonplaceholder-get',
      description: '获取 JSONPlaceholder 文章（GET 示例）',
      inputSchema: {
        type: 'object' as const,
        properties: {
          postId: { type: 'number', description: '文章 ID' }
        },
        required: ['postId']
      },
      handler: {
        type: 'http' as const,
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'GET' as const,
        timeout: 10000
      }
    },
    {
      name: 'jsonplaceholder-post',
      description: '创建 JSONPlaceholder 文章（POST 示例）',
      inputSchema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: '文章标题' },
          body: { type: 'string', description: '文章内容' },
          userId: { type: 'number', description: '用户 ID' }
        },
        required: ['title', 'body', 'userId']
      },
      handler: {
        type: 'http' as const,
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST' as const,
        timeout: 10000
      }
    }
  ]

  for (const tool of sampleTools) {
    try {
      const existing = registry.get(tool.name)
      if (!existing) {
        registry.register(tool)
        const registeredTool = registry.get(tool.name)
        if (registeredTool) {
          eventEmitter.emit('tool_registered', { tool: registeredTool })
          console.log(`[Sample] Registered tool: ${tool.name}`)
        }
      }
    } catch (err) {
      console.error(`[Sample] Failed to register ${tool.name}:`, err)
    }
  }
}

/**
 * 初始化示例 Skill
 */
async function initializeSampleSkills(
  skillRegistry: import('./core/skillRegistry').SkillRegistry,
  eventEmitter: EventEmitter
) {
  const sampleSkills = [
    {
      name: 'weather_recommend',
      displayName: '天气活动推荐',
      description: '根据天气情况推荐合适的活动',
      triggerPhrases: ['推荐活动', '周末干什么', '天气怎么样'],
      exposeModes: {
        asSkill: true,
        asTool: true,
        asPrompt: true
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          city: { type: 'string', description: '城市名称' },
          date: { type: 'string', description: '日期' }
        },
        required: ['city']
      },
      nodes: [
        {
          id: 'start',
          type: 'start' as const,
          name: '开始',
          config: {},
          position: { x: 0, y: 0 }
        },
        {
          id: 'weather_node',
          type: 'tool' as const,
          name: '查询天气',
          config: {
            toolName: 'weather_query',
            inputMapping: {
              city: '${input.city}'
            }
          },
          position: { x: 0, y: 100 }
        },
        {
          id: 'end',
          type: 'end' as const,
          name: '结束',
          config: {},
          position: { x: 0, y: 200 }
        }
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'weather_node' },
        { id: 'e2', source: 'weather_node', target: 'end' }
      ]
    }
  ]

  for (const skill of sampleSkills) {
    try {
      const existing = skillRegistry.get(skill.name)
      if (!existing) {
        const registeredSkill = skillRegistry.register(skill)
        eventEmitter.emit('skill_registered', { skill: registeredSkill })
        console.log(`[Sample] Registered skill: ${skill.name}`)
      }
    } catch (err) {
      console.error(`[Sample] Failed to register ${skill.name}:`, err)
    }
  }
}

main().catch(console.error)