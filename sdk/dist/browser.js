"use strict";
var mcpBridgeSdk = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    MCPBridgeClient: () => MCPBridgeClient
  });

  // src/client.ts
  var MCPBridgeClient = class {
    /**
     * 创建 MCP Bridge 客户端
     * @param options 配置选项
     */
    constructor(options) {
      this.ws = null;
      this.options = {};
      this.listeners = /* @__PURE__ */ new Map();
      this.heartbeatTimer = null;
      this.reconnectTimer = null;
      /** 是否已连接 */
      this.connected = false;
      /** 客户端 ID */
      this.clientId = null;
      /** 已注册的工具名称 */
      this.registeredTools = [];
      this.apiUrl = options?.apiUrl || "http://localhost:3000/api/tools";
      this.wsUrl = options?.wsUrl || "ws://localhost:3000/ws";
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
      const { name, description, params = [], timeout = 3e4 } = config;
      const inputSchema = this.buildInputSchema(params);
      await this.registerTool({
        name,
        description,
        inputSchema,
        timeout
      });
      this.registeredTools.push(name);
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
      for (const tool of tools) {
        if ("inputSchema" in tool) {
          await this.registerTool(tool);
        } else {
          const inputSchema = this.buildInputSchema(tool.params || []);
          await this.registerTool({
            name: tool.name,
            description: tool.description,
            inputSchema,
            timeout: tool.timeout || 3e4
          });
        }
        this.registeredTools.push(tool.name);
      }
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
          type: param.type || "string",
          ...param.description && { description: param.description }
        };
        if (param.required !== false) {
          required.push(param.name);
        }
      }
      return {
        type: "object",
        properties,
        ...required.length > 0 && { required }
      };
    }
    /**
     * 调用 API 注册工具
     */
    async registerTool(tool) {
      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          handler: { type: "websocket", timeout: tool.timeout || 3e4 }
        })
      });
      const data = await res.json();
      if (!data.success && data.error?.code !== "DUPLICATE_TOOL") {
        throw new Error(data.error?.message || "\u6CE8\u518C\u5DE5\u5177\u5931\u8D25");
      }
    }
    /**
     * 连接 WebSocket 并注册
     */
    connect(options = {}) {
      return new Promise((resolve, reject) => {
        this.options = options;
        const { heartbeatInterval = 25e3 } = options;
        try {
          this.ws = new WebSocket(this.wsUrl);
        } catch (error) {
          reject(error);
          return;
        }
        this.ws.onopen = () => {
          this.send({
            type: "register",
            clientId: options.clientId,
            capabilities: options.capabilities || []
          });
          this.startHeartbeat(heartbeatInterval);
        };
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message, resolve);
          } catch (error) {
            console.error("Failed to parse message:", error);
          }
        };
        this.ws.onclose = (event) => {
          this.connected = false;
          this.stopHeartbeat();
          this.emit("disconnected", { reason: event.reason });
          if (options.autoReconnect) {
            this.scheduleReconnect();
          }
        };
        this.ws.onerror = () => {
          if (!this.connected) {
            reject(new Error("WebSocket connection failed"));
          }
          this.emit("error", { code: "CONNECTION_ERROR", message: "WebSocket error" });
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
        type: "tool_response",
        requestId,
        success: !error,
        result: error ? void 0 : result,
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
    respondError(requestId, message, code = "EXECUTION_FAILED") {
      this.respond(requestId, void 0, { code, message });
    }
    /**
     * 订阅事件
     */
    subscribe(events) {
      this.send({
        type: "subscribe",
        events
      });
    }
    /**
     * 取消订阅
     */
    unsubscribe(events) {
      this.send({
        type: "unsubscribe",
        events
      });
    }
    /**
     * 监听事件
     */
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, /* @__PURE__ */ new Set());
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
        case "connected":
          break;
        case "registered":
          this.connected = true;
          this.clientId = message.clientId;
          this.emit("connected", { clientId: this.clientId });
          resolveConnect({ clientId: this.clientId });
          break;
        case "pong":
          break;
        case "tool_request":
          this.emit("tool_request", {
            requestId: message.requestId,
            tool: message.tool,
            action: message.action,
            arguments: message.arguments,
            timeout: message.timeout,
            timestamp: message.timestamp
          });
          break;
        case "tool_invoked":
        case "tool_registered":
        case "tool_deleted":
        case "tool_updated":
          this.emit(message.type, {
            type: message.type,
            timestamp: message.timestamp,
            data: message.data
          });
          break;
        case "error":
          this.emit("error", {
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
        this.send({ type: "ping" });
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
      const { reconnectDelay = 3e3 } = this.options;
      this.reconnectTimer = setTimeout(() => {
        this.connect(this.options).catch(() => {
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
  };
  return __toCommonJS(src_exports);
})();
