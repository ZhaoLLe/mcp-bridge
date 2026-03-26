/**
 * 完整端到端验证脚本
 *
 * 这个脚本同时运行：
 * 1. WebSocket 客户端（模拟前端）
 * 2. HTTP 调用（模拟 Claude 调用）
 */

import WebSocket from 'ws'

const WS_URL = 'ws://localhost:3000/ws'
const API_URL = 'http://localhost:3000/api/tools'

async function main() {
  console.log('========================================')
  console.log('  MCP 端到端验证')
  console.log('========================================\n')

  // 1. 创建 WebSocket 客户端
  console.log('📍 步骤 1: 连接 WebSocket...')

  const ws = new WebSocket(WS_URL)
  let clientId = null

  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('   ✅ WebSocket 已连接')

      // 注册客户端
      ws.send(JSON.stringify({
        type: 'register',
        capabilities: ['*']  // 注册所有能力
      }))
    })

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())

      if (msg.type === 'registered') {
        clientId = msg.clientId
        console.log('   ✅ 客户端已注册, ID:', clientId.slice(0, 8) + '...')
        resolve()
      }

      if (msg.type === 'tool_request') {
        console.log('\n📥 收到工具执行请求:')
        console.log('   工具:', msg.tool)
        console.log('   参数:', JSON.stringify(msg.arguments))
        console.log('   请求ID:', msg.requestId.slice(0, 8) + '...')

        // 模拟执行并返回结果
        setTimeout(() => {
          const result = {
            city: msg.arguments.city,
            temperature: 25,
            condition: '晴天',
            humidity: 60
          }

          console.log('\n📤 返回结果:', JSON.stringify(result))

          ws.send(JSON.stringify({
            type: 'tool_response',
            requestId: msg.requestId,
            success: true,
            result
          }))
        }, 1000)
      }
    })

    ws.on('error', (err) => {
      console.log('   ❌ WebSocket 错误:', err.message)
      reject(err)
    })

    setTimeout(() => reject(new Error('连接超时')), 5000)
  })

  console.log('\n📍 步骤 2: 调用工具 (模拟 Claude 调用)...\n')

  // 2. 通过 HTTP API 调用工具
  const startTime = Date.now()
  const res = await fetch(`${API_URL}/get_weather/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city: '北京' })
  })

  const data = await res.json()
  const duration = Date.now() - startTime

  console.log('\n📍 步骤 3: 调用结果')
  console.log('   耗时:', duration + 'ms')
  console.log('   成功:', data.success)
  if (data.success) {
    console.log('   结果:', JSON.stringify(data.data?.result, null, 2))
  } else {
    console.log('   错误:', data.data?.error)
  }

  // 3. 断开连接
  ws.close()
  console.log('\n========================================')
  console.log('✅ 验证完成!')
  console.log('========================================')
}

main().catch((err) => {
  console.error('\n❌ 验证失败:', err.message)
  console.error('\n请确保服务正在运行: npm run dev')
  process.exit(1)
})