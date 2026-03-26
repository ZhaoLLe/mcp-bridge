/**
 * MCP Bridge 配置
 */

export const config = {
  // 服务端口
  port: parseInt(process.env.MCP_BRIDGE_PORT || '3000', 10),

  // 服务 URL（用于生成 MCP 配置）
  serverUrl: process.env.MCP_BRIDGE_URL || 'http://localhost:3000',

  // MCP 服务器配置
  mcp: {
    name: process.env.MCP_NAME || 'mcp-bridge',
    version: '1.0.0',
  },

  // WebSocket 配置
  websocket: {
    path: '/ws',
    heartbeat: 30000, // 心跳间隔（毫秒）
  },
}