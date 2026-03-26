/**
 * MCP Bridge SDK Client
 */
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
export class MCPBridgeClient {
    /**
     * 创建 MCP Bridge 客户端
     * @param options 配置选项
     */
    constructor(options) {
        this.ws = null;
        this.options = {};
        this.listeners = new Map();
        this.heartbeatTimer = null;
        this.reconnectTimer = null;
        /** 是否已连接 */
        this.connected = false;
        /** 客户端 ID */
        this.clientId = null;
        /** 已注册的工具名称 */
        this.registeredTools = [];
        this.apiUrl = options?.apiUrl || 'http://localhost:3000/api/tools';
        this.wsUrl = options?.wsUrl || 'ws://localhost:3000/ws';
    }
    /**
     * 注册工具并连接（简化用法，与 simple 一致）
     *
     * @param config 工具配置
     * @param config.name 工具名称
     * @param config.description 工具描述
     * @param config.params 参数列表（简化的参数定义）
     * @param config.timeout 超时时间（毫秒），默认 30000
     */
    async register(config) {
        const { name, description, params = [], timeout = 30000 } = config;
        // 构建 inputSchema
        const inputSchema = this.buildInputSchema(params);
        // 1. 注册工具
        await this.registerTool({
            name,
            description,
            inputSchema,
            timeout
        });
        this.registeredTools.push(name);
        // 2. 连接 WebSocket
        await this.connect({
            capabilities: [name]
        });
    }
    /**
     * 注册多个工具并连接
     *
     * @param tools 工具定义列表
     */
    async registerAll(tools) {
        // 注册所有工具
        for (const tool of tools) {
            if ('inputSchema' in tool) {
                await this.registerTool(tool);
            }
            else {
                const inputSchema = this.buildInputSchema(tool.params || []);
                await this.registerTool({
                    name: tool.name,
                    description: tool.description,
                    inputSchema,
                    timeout: tool.timeout || 30000
                });
            }
            this.registeredTools.push(tool.name);
        }
        // 连接 WebSocket
        await this.connect({
            capabilities: this.registeredTools
        });
    }
    /**
     * 构建输入 Schema
     */
    buildInputSchema(params) {
        const properties = {};
        const required = [];
        for (const param of params) {
            properties[param.name] = {
                type: param.type || 'string',
                ...(param.description && { description: param.description })
            };
            if (param.required !== false) {
                required.push(param.name);
            }
        }
        return {
            type: 'object',
            properties,
            ...(required.length > 0 && { required })
        };
    }
    /**
     * 调用 API 注册工具
     */
    async registerTool(tool) {
        const res = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                handler: { type: 'websocket', timeout: tool.timeout || 30000 }
            })
        });
        const data = await res.json();
        if (!data.success && data.error?.code !== 'DUPLICATE_TOOL') {
            throw new Error(data.error?.message || '注册工具失败');
        }
    }
    /**
     * 连接 WebSocket 并注册
     */
    connect(options = {}) {
        return new Promise((resolve, reject) => {
            this.options = options;
            const { heartbeatInterval = 25000 } = options;
            try {
                this.ws = new WebSocket(this.wsUrl);
            }
            catch (error) {
                reject(error);
                return;
            }
            this.ws.onopen = () => {
                // 发送注册消息
                this.send({
                    type: 'register',
                    clientId: options.clientId,
                    capabilities: options.capabilities || []
                });
                // 启动心跳
                this.startHeartbeat(heartbeatInterval);
            };
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message, resolve);
                }
                catch (error) {
                    console.error('Failed to parse message:', error);
                }
            };
            this.ws.onclose = (event) => {
                this.connected = false;
                this.stopHeartbeat();
                this.emit('disconnected', { reason: event.reason });
                // 自动重连
                if (options.autoReconnect) {
                    this.scheduleReconnect();
                }
            };
            this.ws.onerror = () => {
                if (!this.connected) {
                    reject(new Error('WebSocket connection failed'));
                }
                this.emit('error', { code: 'CONNECTION_ERROR', message: 'WebSocket error' });
            };
        });
    }
    /**
     * 断开连接
     */
    disconnect() {
        this.stopHeartbeat();
        this.cancelReconnect();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.clientId = null;
        this.registeredTools = [];
    }
    /**
     * 响应工具请求
     *
     * @param requestId 请求 ID
     * @param result 返回结果
     * @param error 错误信息（可选）
     */
    respond(requestId, result, error) {
        this.send({
            type: 'tool_response',
            requestId,
            success: !error,
            result: error ? undefined : result,
            error
        });
    }
    /**
     * 响应成功
     */
    respondSuccess(requestId, result) {
        this.respond(requestId, result);
    }
    /**
     * 响应失败
     */
    respondError(requestId, message, code = 'EXECUTION_FAILED') {
        this.respond(requestId, undefined, { code, message });
    }
    /**
     * 订阅事件
     */
    subscribe(events) {
        this.send({
            type: 'subscribe',
            events
        });
    }
    /**
     * 取消订阅
     */
    unsubscribe(events) {
        this.send({
            type: 'unsubscribe',
            events
        });
    }
    /**
     * 监听事件
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }
    /**
     * 移除监听
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }
    /**
     * 发送消息
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    /**
     * 触发事件
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                callback(data);
            }
        }
    }
    /**
     * 处理消息
     */
    handleMessage(message, resolveConnect) {
        switch (message.type) {
            case 'connected':
                // 欢迎消息，等待注册确认
                break;
            case 'registered':
                this.connected = true;
                this.clientId = message.clientId;
                this.emit('connected', { clientId: this.clientId });
                resolveConnect({ clientId: this.clientId });
                break;
            case 'pong':
                // 心跳响应
                break;
            case 'tool_request':
                this.emit('tool_request', {
                    requestId: message.requestId,
                    tool: message.tool,
                    action: message.action,
                    arguments: message.arguments,
                    timeout: message.timeout,
                    timestamp: message.timestamp
                });
                break;
            case 'tool_invoked':
            case 'tool_registered':
            case 'tool_deleted':
            case 'tool_updated':
                this.emit(message.type, {
                    type: message.type,
                    timestamp: message.timestamp,
                    data: message.data
                });
                break;
            case 'error':
                this.emit('error', {
                    code: message.code,
                    message: message.message
                });
                break;
        }
    }
    /**
     * 启动心跳
     */
    startHeartbeat(interval) {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            this.send({ type: 'ping' });
        }, interval);
    }
    /**
     * 停止心跳
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    /**
     * 安排重连
     */
    scheduleReconnect() {
        const { reconnectDelay = 3000 } = this.options;
        this.reconnectTimer = setTimeout(() => {
            this.connect(this.options).catch(() => {
                // 重连失败，会再次触发 onclose，自动重试
            });
        }, reconnectDelay);
    }
    /**
     * 取消重连
     */
    cancelReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
//# sourceMappingURL=client.js.map