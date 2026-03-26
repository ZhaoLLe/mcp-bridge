/**
 * MCP Bridge SDK
 *
 * 用于连接 MCP Bridge 的前端 SDK
 *
 * @example 基本用法（与 simple 一致）
 * ```typescript
 * import { MCPBridgeClient } from 'mcp-bridge-sdk'
 *
 * const client = new MCPBridgeClient()
 *
 * // 注册工具并连接
 * await client.register({
 *   name: 'get_weather',
 *   description: '获取指定城市的天气信息',
 *   params: [
 *     { name: 'city', description: '城市名称' },
 *     { name: 'unit', description: '温度单位', required: false }
 *   ]
 * })
 *
 * // 监听工具执行请求
 * client.on('tool_request', (request) => {
 *   const { requestId, tool, arguments: args } = request
 *   if (tool === 'get_weather') {
 *     client.respond(requestId, { temp: 25, city: args.city })
 *   }
 * })
 *
 * // 断开连接
 * client.disconnect()
 * ```
 *
 * @example 注册多个工具
 * ```typescript
 * const client = new MCPBridgeClient()
 *
 * await client.registerAll([
 *   {
 *     name: 'get_weather',
 *     description: '获取天气信息',
 *     params: [{ name: 'city', description: '城市名称' }]
 *   },
 *   {
 *     name: 'search_web',
 *     description: '搜索网页',
 *     params: [
 *       { name: 'query', description: '搜索关键词' },
 *       { name: 'limit', description: '结果数量', type: 'number', required: false }
 *     ]
 *   }
 * ])
 * ```
 */
export { MCPBridgeClient } from './client';
export type { ConnectOptions, ToolDefinition, SimpleParam, ToolInputSchema, JSONSchemaProperty, JSONSchemaType, ToolRequest, EventType, ErrorCode, ErrorResponse, EventPayload, SDKEventMap, EventCallback } from './types';
//# sourceMappingURL=index.d.ts.map