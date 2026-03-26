/**
 * MCP 配置面板
 */

import { useState } from 'react'

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

interface Props {
  config: MCPConfig | null
}

export function MCPConfigPanel({ config }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!config) return

    const configStr = JSON.stringify(config.claudeConfig, null, 2)
    await navigator.clipboard.writeText(configStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!config) {
    return (
      <div className="panel mcp-config-panel">
        <h2>MCP 配置</h2>
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af' }}>
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div className="panel mcp-config-panel">
      <h2>Claude Desktop 配置</h2>
      <p className="hint">复制以下配置到 Claude Desktop 配置文件：</p>
      <code className="config-block">
        {JSON.stringify(config.claudeConfig, null, 2)}
      </code>
      <div className="actions" style={{ marginTop: 12 }}>
        <button className="primary" onClick={handleCopy}>
          {copied ? '已复制!' : '复制配置'}
        </button>
      </div>
      <div className="config-info">
        <p><strong>SSE 端点:</strong> {config.sseEndpoint}</p>
        <p><strong>已注册工具:</strong> {config.tools.join(', ') || '无'}</p>
      </div>
    </div>
  )
}