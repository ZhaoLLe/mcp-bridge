/**
 * MCP 本地验证脚本
 *
 * 这个脚本模拟 Claude 调用 MCP 工具的完整流程
 *
 * 运行方式：
 * 1. 终端1: 启动服务 npm run dev
 * 2. 终端2: 打开 sdk/test.html 连接 WebSocket
 * 3. 终端3: 运行此脚本 node scripts/verify-local.mjs
 */

const SSE_URL = 'http://localhost:3000/sse'
const API_URL = 'http://localhost:3000/api/tools'

async function main() {
  console.log('========================================')
  console.log('  MCP Bridge 本地验证')
  console.log('========================================\n')

  // 1. 检查服务状态
  console.log('📍 步骤 1: 检查服务状态')
  try {
    const health = await fetch('http://localhost:3000/health')
    const healthData = await health.json()
    console.log('   ✅ 服务运行中:', healthData)
  } catch (e) {
    console.log('   ❌ 服务未运行，请先执行: npm run dev')
    process.exit(1)
  }
  console.log('')

  // 2. 获取已注册的工具
  console.log('📍 步骤 2: 获取已注册的工具')
  const toolsRes = await fetch(API_URL)
  const toolsData = await toolsRes.json()
  console.log('   已注册工具:', toolsData.data.tools.map(t => t.name).join(', ') || '无')
  console.log('')

  if (toolsData.data.tools.length === 0) {
    console.log('⚠️  没有注册任何工具，先注册一个测试工具')
    await registerTestTool()
  }
  console.log('')

  // 3. 模拟 MCP 客户端连接 SSE
  console.log('📍 步骤 3: 模拟 MCP 客户端连接 SSE')
  console.log('   连接地址:', SSE_URL)

  // 使用 fetch 测试 SSE 端点
  try {
    const sseRes = await fetch(SSE_URL)
    const reader = sseRes.body.getReader()
    const decoder = new TextDecoder()

    // 读取第一个事件
    const { value, done } = await reader.read()
    if (!done) {
      const text = decoder.decode(value)
      console.log('   ✅ SSE 连接成功')
      console.log('   收到事件:', text.split('\n').filter(l => l).join('\n   '))
    }

    // 取消读取
    reader.cancel()
  } catch (e) {
    console.log('   ❌ SSE 连接失败:', e.message)
  }
  console.log('')

  // 4. 测试工具调用 API
  console.log('📍 步骤 4: 测试工具调用')
  const testTool = toolsData.data.tools[0]
  if (testTool) {
    console.log(`   调用工具: ${testTool.name}`)
    console.log('   ⚠️  注意: 这需要前端已连接 WebSocket 并注册了能力')
    console.log('   请确保已在浏览器中打开 sdk/test.html 并点击"连接"')
    console.log('')
    console.log('   执行调用...')

    try {
      const invokeRes = await fetch(`${API_URL}/${testTool.name}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: '北京' })
      })
      const invokeData = await invokeRes.json()
      console.log('   结果:', JSON.stringify(invokeData, null, 2))
    } catch (e) {
      console.log('   ❌ 调用失败:', e.message)
    }
  }
  console.log('')

  // 5. 输出 Claude Desktop 配置
  console.log('📍 步骤 5: Claude Desktop 配置')
  const mcpConfig = await fetch(`${API_URL}/mcp-config`)
  const configData = await mcpConfig.json()
  if (configData.success) {
    console.log('   复制以下配置到 Claude Desktop:')
    console.log('   文件位置: ~/Library/Application Support/Claude/claude_desktop_config.json')
    console.log('')
    console.log(JSON.stringify(configData.data.claudeConfig, null, 2))
  }
  console.log('')

  console.log('========================================')
  console.log('验证完成!')
  console.log('========================================')
}

async function registerTestTool() {
  console.log('   注册测试工具...')
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'get_weather',
      description: '获取指定城市的天气信息。当用户询问天气时使用此工具。',
      inputSchema: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市名称，如：北京、上海、广州'
          }
        },
        required: ['city']
      },
      handler: {
        type: 'websocket',
        timeout: 30000
      }
    })
  })
  const data = await res.json()
  if (data.success) {
    console.log('   ✅ 注册成功:', data.data.tool.name)
  } else {
    console.log('   ❌ 注册失败:', data.error)
  }
}

main().catch(console.error)