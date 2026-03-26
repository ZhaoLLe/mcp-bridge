/**
 * MCP Bridge SDK Client
 */
import type { ConnectOptions, ToolDefinition, SimpleParam, EventType, ErrorCode, ErrorResponse, SDKEventMap, EventCallback } from './types';
/**
 * MCP Bridge 客户端
 *
 * @example 基本用法（与 simple 一致）
 * ```typescript
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
 */
export declare class MCPBridgeClient {
    private apiUrl;
    private wsUrl;
    private ws;
    private options;
    private listeners;
    private heartbeatTimer;
    private reconnectTimer;
    /** 是否已连接 */
    connected: boolean;
    /** 客户端 ID */
    clientId: string | null;
    /** 已注册的工具名称 */
    registeredTools: string[];
    /**
     * 创建 MCP Bridge 客户端
     * @param options 配置选项
     */
    constructor(options?: {
        apiUrl?: string;
        wsUrl?: string;
    });
    /**
     * 注册工具并连接（简化用法，与 simple 一致）
     *
     * @param config 工具配置
     * @param config.name 工具名称
     * @param config.description 工具描述
     * @param config.params 参数列表（简化的参数定义）
     * @param config.timeout 超时时间（毫秒），默认 30000
     */
    register(config: {
        name: string;
        description: string;
        params?: SimpleParam[];
        timeout?: number;
    }): Promise<void>;
    /**
     * 注册多个工具并连接
     *
     * @param tools 工具定义列表
     */
    registerAll(tools: (ToolDefinition | {
        name: string;
        description: string;
        params?: SimpleParam[];
        timeout?: number;
    })[]): Promise<void>;
    /**
     * 构建输入 Schema
     */
    private buildInputSchema;
    /**
     * 调用 API 注册工具
     */
    private registerTool;
    /**
     * 连接 WebSocket 并注册
     */
    connect(options?: ConnectOptions): Promise<{
        clientId: string;
    }>;
    /**
     * 断开连接
     */
    disconnect(): void;
    /**
     * 响应工具请求
     *
     * @param requestId 请求 ID
     * @param result 返回结果
     * @param error 错误信息（可选）
     */
    respond(requestId: string, result: unknown, error?: ErrorResponse): void;
    /**
     * 响应成功
     */
    respondSuccess(requestId: string, result: unknown): void;
    /**
     * 响应失败
     */
    respondError(requestId: string, message: string, code?: ErrorCode): void;
    /**
     * 订阅事件
     */
    subscribe(events: EventType[]): void;
    /**
     * 取消订阅
     */
    unsubscribe(events: EventType[]): void;
    /**
     * 监听事件
     */
    on<K extends keyof SDKEventMap>(event: K, callback: EventCallback<K>): void;
    /**
     * 移除监听
     */
    off<K extends keyof SDKEventMap>(event: K, callback: EventCallback<K>): void;
    /**
     * 发送消息
     */
    private send;
    /**
     * 触发事件
     */
    private emit;
    /**
     * 处理消息
     */
    private handleMessage;
    /**
     * 启动心跳
     */
    private startHeartbeat;
    /**
     * 停止心跳
     */
    private stopHeartbeat;
    /**
     * 安排重连
     */
    private scheduleReconnect;
    /**
     * 取消重连
     */
    private cancelReconnect;
}
//# sourceMappingURL=client.d.ts.map