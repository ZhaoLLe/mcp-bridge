/**
 * MCP Bridge Web UI 主应用
 */

import { useState, useEffect } from 'react'
import { ToolsPanel } from './components/ToolsPanel'
import { ToolDetail } from './components/ToolDetail'
import { MCPConfigPanel } from './components/MCPConfigPanel'
import { ExecutionPanel } from './components/ExecutionPanel'
import { LogPanel } from './components/LogPanel'
import { CreateToolModal } from './components/CreateToolModal'
import { useWebSocket } from './hooks/useWebSocket'
import { useApi } from './hooks/useApi'

interface LogEntry {
  id: number
  timestamp: string
  type: string
  data: unknown
}

interface MCPConfig {
  serverName: string
  serverUrl: string
  sseEndpoint: string
  claudeConfig: {
    mcpServers: {
      [key: string]: {
        url: string
      }
    }
  }
  tools: string[]
}

export function App() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [mcpConfig, setMcpConfig] = useState<MCPConfig | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { connected, clientId, toolRequests, respond } = useWebSocket({
    url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  })

  const {
    tools,
    loading,
    error,
    refreshTools,
    createTool,
    deleteTool,
    invokeTool,
    getMCPConfig
  } = useApi()

  // 初始加载工具列表
  useEffect(() => {
    refreshTools()
  }, [refreshTools])

  // 获取 MCP 配置
  useEffect(() => {
    getMCPConfig().then(setMcpConfig)
  }, [tools, getMCPConfig])

  // 添加日志
  const addLog = (type: string, data: unknown) => {
    setLogs(prev => [...prev.slice(-99), {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type,
      data
    }])
  }

  // 处理工具调用
  const handleInvoke = async (args: Record<string, unknown>) => {
    if (!selectedTool) return

    addLog('invoke', { tool: selectedTool, arguments: args })
    const result = await invokeTool(selectedTool, args)
    addLog('invoke_result', result)
  }

  // 处理创建工具
  const handleCreateTool = async (tool: {
    name: string
    description: string
    inputSchema: {
      type: 'object'
      properties: Record<string, { type: string; description?: string }>
      required?: string[]
    }
    handler: {
      type: 'websocket'
      action?: string
      timeout?: number
    }
  }) => {
    const result = await createTool(tool)
    if (result.success) {
      setShowCreateModal(false)
      addLog('tool_created', result.tool)
      if (result.mcpConfig) {
        setMcpConfig(result.mcpConfig)
      }
    } else {
      alert(result.error || '创建失败')
    }
  }

  // 处理删除工具
  const handleDeleteTool = async (name: string) => {
    const result = await deleteTool(name)
    if (result.success) {
      addLog('tool_deleted', { name })
      if (selectedTool === name) {
        setSelectedTool(null)
      }
    } else {
      alert(result.error || '删除失败')
    }
  }

  // 处理执行响应
  const handleRespond = (requestId: string, success: boolean, result?: unknown) => {
    addLog('tool_response', { requestId, success, result })
    respond(requestId, success, result)
  }

  const selectedToolData = tools.find(t => t.name === selectedTool) || null

  return (
    <div className="app">
      <header>
        <h1>MCP Bridge</h1>
        <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? `已连接 (${clientId?.slice(0, 8)}...)` : '未连接'}
        </span>
      </header>

      <main>
        <div className="row">
          <ToolsPanel
            tools={tools}
            selectedTool={selectedTool}
            onSelect={setSelectedTool}
            onDelete={handleDeleteTool}
            onRefresh={refreshTools}
            onCreate={() => setShowCreateModal(true)}
          />

          <MCPConfigPanel config={mcpConfig} />
        </div>

        <div className="row">
          <ToolDetail
            tool={selectedToolData}
            onInvoke={handleInvoke}
          />

          <ExecutionPanel
            requests={toolRequests}
            onRespond={handleRespond}
          />
        </div>

        <LogPanel logs={logs} />
      </main>

      {showCreateModal && (
        <CreateToolModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTool}
        />
      )}
    </div>
  )
}