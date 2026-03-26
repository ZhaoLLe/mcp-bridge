/**
 * 工具列表面板
 */

import { useState, useEffect } from 'react'

interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, {
      type: string
      description?: string
    }>
    required?: string[]
  }
  handler: {
    type: 'websocket'
    action?: string
    timeout?: number
    target?: 'all' | 'first' | 'specific'
    clientId?: string
  }
  createdAt: number
  updatedAt: number
}

interface Props {
  tools: Tool[]
  selectedTool: string | null
  onSelect: (name: string | null) => void
  onDelete: (name: string) => void
  onRefresh: () => void
  onCreate: () => void
}

export function ToolsPanel({ tools, selectedTool, onSelect, onDelete, onRefresh, onCreate }: Props) {
  return (
    <div className="panel tools-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>工具列表</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary" onClick={onRefresh}>刷新</button>
          <button className="primary" onClick={onCreate}>+ 注册工具</button>
        </div>
      </div>

      {tools.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          暂无工具，点击"注册工具"添加
        </div>
      ) : (
        <ul className="tools-list">
          {tools.map(tool => (
            <li
              key={tool.name}
              className={selectedTool === tool.name ? 'selected' : ''}
              onClick={() => onSelect(tool.name)}
            >
              <div>
                <div className="tool-name">{tool.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  {tool.description.slice(0, 50)}{tool.description.length > 50 ? '...' : ''}
                </div>
              </div>
              <div className="tool-actions">
                <button
                  className="danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`确定删除工具 "${tool.name}"？`)) {
                      onDelete(tool.name)
                    }
                  }}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}