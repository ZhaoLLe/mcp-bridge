# MCP Bridge SDK 使用指南

## 安装

```bash
# 从本地安装
npm install /path/to/mcp-bridge/sdk

# 或发布到 npm 后
npm install mcp-bridge-sdk
```

## 快速开始

```typescript
import { MCPBridgeClient } from 'mcp-bridge-sdk'

// 创建客户端
const client = new MCPBridgeClient('ws://localhost:3000/ws')

// 连接并注册
await client.connect({
  clientId: 'my-app',           // 可选，自定义客户端 ID
  capabilities: ['get_weather'] // 声明能执行的工具
})

console.log('已连接，客户端 ID:', client.clientId)

// 监听工具执行请求
client.on('tool_request', async (request) => {
  const { requestId, tool, action, arguments: args } = request

  console.log(`收到工具请求: ${tool}`, args)

  try {
    // 执行你的业务逻辑
    let result

    if (tool === 'get_weather') {
      result = await fetchWeather(args.city as string)
    }

    // 返回成功结果
    client.respond(requestId, result)

  } catch (error) {
    // 返回错误
    client.respond(requestId, null, {
      code: 'EXECUTION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 断开连接
// client.disconnect()
```

## API 参考

### `MCPBridgeClient`

#### 构造函数

```typescript
const client = new MCPBridgeClient(url: string)
```

- `url` - MCP Bridge WebSocket 地址，如 `ws://localhost:3000/ws`

#### 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `connected` | `boolean` | 是否已连接 |
| `clientId` | `string \| null` | 客户端 ID |

#### 方法

##### `connect(options?)`

连接 WebSocket 并注册客户端。

```typescript
await client.connect({
  clientId?: string       // 可选，自定义客户端 ID
  capabilities?: string[] // 可选，能力列表
  heartbeatInterval?: number // 可选，心跳间隔（默认 25000ms）
  autoReconnect?: boolean    // 可选，自动重连（默认 false）
  reconnectDelay?: number    // 可选，重连延迟（默认 3000ms）
})
```

##### `disconnect()`

断开连接。

```typescript
client.disconnect()
```

##### `respond(requestId, result, error?)`

响应工具请求。

```typescript
// 成功响应
client.respond(requestId, { temperature: 25 })

// 错误响应
client.respond(requestId, null, {
  code: 'EXECUTION_FAILED',
  message: '获取天气失败'
})
```

##### `subscribe(events)`

订阅事件。

```typescript
client.subscribe(['tool_invoked', 'tool_registered'])
```

##### `unsubscribe(events)`

取消订阅事件。

```typescript
client.unsubscribe(['tool_invoked'])
```

##### `on(event, callback)`

监听事件。

```typescript
client.on('tool_request', (request) => { ... })
client.on('connected', (data) => { ... })
client.on('disconnected', (data) => { ... })
```

##### `off(event, callback)`

移除事件监听。

```typescript
const handler = (request) => { ... }
client.on('tool_request', handler)
client.off('tool_request', handler)
```

## 事件

| 事件 | 数据类型 | 说明 |
|------|----------|------|
| `connected` | `{ clientId: string }` | 连接成功 |
| `disconnected` | `{ reason?: string }` | 连接断开 |
| `tool_request` | `ToolRequest` | 工具执行请求 |
| `tool_invoked` | `EventPayload` | 工具被调用 |
| `tool_registered` | `EventPayload` | 工具被注册 |
| `tool_deleted` | `EventPayload` | 工具被删除 |
| `tool_updated` | `EventPayload` | 工具被更新 |
| `error` | `ErrorResponse` | 错误 |

## 完整示例

### React 应用示例

```typescript
// useMCPBridge.ts
import { useEffect, useState } from 'react'
import { MCPBridgeClient, ToolRequest } from 'mcp-bridge-sdk'

export function useMCPBridge(url: string) {
  const [client] = useState(() => new MCPBridgeClient(url))
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    client.connect({
      capabilities: ['*']
    }).then(() => {
      setConnected(true)
    })

    client.on('disconnected', () => {
      setConnected(false)
    })

    return () => {
      client.disconnect()
    }
  }, [client])

  const registerToolHandler = (
    toolName: string,
    handler: (args: Record<string, unknown>) => Promise<unknown>
  ) => {
    const listener = async (request: ToolRequest) => {
      if (request.tool === toolName) {
        try {
          const result = await handler(request.arguments)
          client.respond(request.requestId, result)
        } catch (error) {
          client.respond(request.requestId, null, {
            code: 'EXECUTION_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    client.on('tool_request', listener)
    return () => client.off('tool_request', listener)
  }

  return { client, connected, registerToolHandler }
}
```

```typescript
// App.tsx
import { useMCPBridge } from './useMCPBridge'

function App() {
  const { connected, registerToolHandler } = useMCPBridge('ws://localhost:3000/ws')

  useEffect(() => {
    // 注册天气工具处理器
    const cleanup = registerToolHandler('get_weather', async (args) => {
      const city = args.city as string
      // 调用天气 API
      return { city, temperature: 25, condition: 'sunny' }
    })

    return cleanup
  }, [registerToolHandler])

  return (
    <div>
      Status: {connected ? 'Connected' : 'Disconnected'}
    </div>
  )
}
```

## 错误码

| 错误码 | 说明 |
|--------|------|
| `INVALID_MESSAGE` | 消息格式错误 |
| `UNKNOWN_MESSAGE_TYPE` | 未知的消息类型 |
| `NOT_REGISTERED` | 客户端未注册 |
| `CLIENT_OFFLINE` | 目标客户端离线 |
| `TIMEOUT` | 执行超时 |
| `EXECUTION_FAILED` | 执行失败 |
| `REJECTED` | 被拒绝 |
| `UNKNOWN_TOOL` | 未知的工具 |