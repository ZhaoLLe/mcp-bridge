/**
 * Tools 管理页面
 */

import React, { useState, useEffect } from 'react'
import { apiClient, type Tool } from '../services/api'
import './ToolsPage.css'

export function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)

  const loadTools = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.getTools()
      setTools(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTools()
  }, [])

  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除工具 "${name}" 吗？`)) return
    try {
      await apiClient.deleteTool(name)
      setTools(tools.filter(t => t.name !== name))
      if (selectedTool?.name === name) {
        setSelectedTool(null)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    }
  }

  const handleToggleStatus = async (name: string) => {
    try {
      const updated = await apiClient.toggleToolStatus(name)
      setTools(tools.map(t => t.name === name ? updated : t))
      if (selectedTool?.name === name) {
        setSelectedTool(updated)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleEdit = (tool: Tool) => {
    setEditingTool(tool)
    setShowEditModal(true)
  }

  const handleTest = (tool: Tool) => {
    setSelectedTool(tool)
    setShowTestModal(true)
  }

  // 筛选工具列表
  const filteredTools = tools.filter(tool => {
    const matchesSearch = search === '' ||
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || tool.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="tools-page">
      <div className="page-header">
        <h1>工具管理</h1>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          + 创建工具
        </button>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          className="search-input"
          placeholder="搜索工具名称或描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="all">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>
        <button className="btn-secondary" onClick={loadTools}>
          刷新
        </button>
      </div>

      <div className="tools-content">
        <div className="tools-list-panel">
          <h2>工具列表 ({filteredTools.length})</h2>
          {loading ? (
            <div className="loading">加载中...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : filteredTools.length === 0 ? (
            <div className="empty-state">
              {search || statusFilter !== 'all' ? '未找到匹配的工具' : '暂无工具'}
            </div>
          ) : (
            <ul className="tools-list">
              {filteredTools.map(tool => (
                <li
                  key={tool.name}
                  className={`tool-item ${selectedTool?.name === tool.name ? 'selected' : ''}`}
                >
                  <div
                    className="tool-info"
                    onClick={() => setSelectedTool(tool)}
                  >
                    <div className="tool-header">
                      <span className="tool-name">{tool.name}</span>
                      <span className={`status-dot ${tool.status}`}></span>
                    </div>
                    <span className="tool-desc">{tool.description}</span>
                    <div className="tool-meta">
                      <span className="handler-tag">{tool.handler.type}</span>
                      {tool.handler.type === 'skill' && (
                        <span className="skill-tag">{tool.handler.skillName}</span>
                      )}
                    </div>
                  </div>
                  <div className="tool-actions">
                    <button
                      className="btn-icon btn-edit-icon"
                      onClick={() => handleEdit(tool)}
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon btn-test-icon"
                      onClick={() => handleTest(tool)}
                      title="测试"
                    >
                      🧪
                    </button>
                    <button
                      className="btn-icon btn-delete-icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(tool.name)
                      }}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="tool-detail-panel">
          {selectedTool ? (
            <ToolDetail
              tool={selectedTool}
              onEdit={() => handleEdit(selectedTool)}
              onTest={() => handleTest(selectedTool)}
              onToggleStatus={() => handleToggleStatus(selectedTool.name)}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🔧</div>
              <p>选择一个工具查看详情</p>
              <p className="hint">或者创建新工具开始</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateToolModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newTool) => {
            setTools([...tools, newTool])
            setShowCreateModal(false)
          }}
        />
      )}

      {showEditModal && editingTool && (
        <EditToolModal
          tool={editingTool}
          onClose={() => {
            setShowEditModal(false)
            setEditingTool(null)
          }}
          onSuccess={(updatedTool) => {
            setTools(tools.map(t => t.name === updatedTool.name ? updatedTool : t))
            setSelectedTool(updatedTool)
            setShowEditModal(false)
            setEditingTool(null)
          }}
        />
      )}

      {showTestModal && selectedTool && (
        <TestToolModal
          tool={selectedTool}
          onClose={() => setShowTestModal(false)}
        />
      )}
    </div>
  )
}

// 工具详情组件
interface ToolDetailProps {
  tool: Tool
  onEdit: () => void
  onTest: () => void
  onToggleStatus: () => void
}

function ToolDetail({ tool, onEdit, onTest, onToggleStatus }: ToolDetailProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  return (
    <>
      <div className="detail-header">
        <h2>{tool.name}</h2>
        <div className="detail-actions">
          <button className="btn-action" onClick={onToggleStatus}>
            {tool.status === 'enabled' ? '禁用' : '启用'}
          </button>
          <button className="btn-action btn-edit" onClick={onEdit}>
            编辑
          </button>
          <button className="btn-primary" onClick={onTest}>
            🧪 测试
          </button>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-section">
          <h3>基本信息</h3>
          <div className="detail-grid">
            <div className="detail-row">
              <label>名称</label>
              <span className="value">{tool.name}</span>
            </div>
            <div className="detail-row">
              <label>状态</label>
              <span className={`status-badge ${tool.status}`}>
                {tool.status === 'enabled' ? '● 已启用' : '○ 已禁用'}
              </span>
            </div>
            <div className="detail-row full-width">
              <label>描述</label>
              <span className="value desc">{tool.description}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h3>Handler 配置</h3>
          <div className="detail-grid">
            <div className="detail-row">
              <label>类型</label>
              <span className="handler-badge">{tool.handler.type}</span>
            </div>
            {tool.handler.type === 'websocket' ? (
              <>
                <div className="detail-row">
                  <label>Action</label>
                  <span className="value">{tool.handler.action || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>超时时间</label>
                  <span className="value">{tool.handler.timeout || 30000}ms</span>
                </div>
                {tool.handler.target && (
                  <div className="detail-row">
                    <label>目标策略</label>
                    <span className="value">{tool.handler.target}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="detail-row full-width">
                <label>Skill 名称</label>
                <span className="value">{tool.handler.skillName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="detail-section">
          <h3>输入 Schema</h3>
          <pre className="schema-block">
            {JSON.stringify(tool.inputSchema, null, 2)}
          </pre>
        </div>

        <div className="detail-section">
          <h3>时间信息</h3>
          <div className="detail-grid">
            <div className="detail-row">
              <label>创建时间</label>
              <span className="value time">{formatTime(tool.createdAt)}</span>
            </div>
            <div className="detail-row">
              <label>更新时间</label>
              <span className="value time">{formatTime(tool.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// 创建工具弹窗组件
interface CreateToolModalProps {
  onClose: () => void
  onSuccess: (tool: Tool) => void
}

function CreateToolModal({ onClose, onSuccess }: CreateToolModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [handlerType, setHandlerType] = useState<'websocket' | 'skill' | 'http'>('websocket')
  const [skillName, setSkillName] = useState('')
  const [action, setAction] = useState('')
  const [timeout, setTimeout] = useState(30000)
  const [target, setTarget] = useState<'all' | 'first' | 'specific'>('all')
  const [clientId, setClientId] = useState('')
  // HTTP Handler 状态
  const [httpUrl, setHttpUrl] = useState('')
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('POST')
  const [httpHeaders, setHttpHeaders] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const handler = handlerType === 'websocket'
        ? {
            type: 'websocket' as const,
            action: action || undefined,
            timeout,
            target: target === 'specific' && clientId ? 'specific' as const : target,
            clientId: target === 'specific' ? clientId || undefined : undefined
          }
        : handlerType === 'skill'
        ? { type: 'skill' as const, skillName }
        : {
            type: 'http' as const,
            url: httpUrl,
            method: httpMethod,
            headers: httpHeaders ? JSON.parse(httpHeaders) : undefined,
            timeout
          }

      const result = await apiClient.createTool({
        name,
        description,
        inputSchema: {
          type: 'object',
          properties: {},
        },
        handler,
      })

      onSuccess(result.tool)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>创建工具</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>基本信息</h3>
            <div className="form-group">
              <label>工具名称 <span className="required">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：hello_tool"
                required
                pattern="^[a-z][a-z0-9_]*$"
                title="必须以小写字母开头，只能包含小写字母、数字和下划线"
              />
            </div>

            <div className="form-group">
              <label>描述 <span className="required">*</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="工具功能描述"
                required
                rows={3}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Handler 配置</h3>
            <div className="form-group">
              <label>Handler 类型</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={handlerType === 'websocket'}
                    onChange={() => setHandlerType('websocket')}
                  />
                  <span>WebSocket</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={handlerType === 'skill'}
                    onChange={() => setHandlerType('skill')}
                  />
                  <span>Skill</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={handlerType === 'http'}
                    onChange={() => setHandlerType('http')}
                  />
                  <span>HTTP</span>
                </label>
              </div>
            </div>

            {handlerType === 'websocket' && (
              <div className="form-hint" style={{ background: '#fff7ed', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fed7aa', marginBottom: '16px' }}>
                <strong style={{ color: '#ea580c' }}>⚠️ 仅适用于三方系统接入</strong>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#9a3412', lineHeight: '1.6' }}>
                  WebSocket Handler 用于外部系统连接到 MCP Bridge 并执行工具。
                  需要外部系统通过 WebSocket 连接到此服务，注册工具能力，并响应 tool_request 消息。
                </p>
              </div>
            )}

            {handlerType === 'skill' ? (
              <div className="form-group">
                <label>Skill 名称 <span className="required">*</span></label>
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="例如：my_skill"
                  required
                />
              </div>
            ) : handlerType === 'http' ? (
              <>
                <div className="form-group">
                  <label>接口 URL <span className="required">*</span></label>
                  <input
                    type="url"
                    value={httpUrl}
                    onChange={(e) => setHttpUrl(e.target.value)}
                    placeholder="https://api.example.com/endpoint"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>HTTP 方法</label>
                    <select value={httpMethod} onChange={(e) => setHttpMethod(e.target.value as any)}>
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>超时时间 (ms)</label>
                    <input
                      type="number"
                      value={timeout}
                      onChange={(e) => setTimeout(Number(e.target.value))}
                      min={1000}
                      max={300000}
                      step={1000}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>自定义 Headers (JSON 格式，可选)</label>
                  <textarea
                    value={httpHeaders}
                    onChange={(e) => setHttpHeaders(e.target.value)}
                    placeholder='{"Authorization": "Bearer xxx", "X-Custom-Header": "value"}'
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>Action (可选)</label>
                  <input
                    type="text"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="客户端 action 标识"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>超时时间 (ms)</label>
                    <input
                      type="number"
                      value={timeout}
                      onChange={(e) => setTimeout(Number(e.target.value))}
                      min={1000}
                      max={300000}
                      step={1000}
                    />
                  </div>
                  <div className="form-group">
                    <label>目标策略</label>
                    <select value={target} onChange={(e) => setTarget(e.target.value as any)}>
                      <option value="all">所有客户端</option>
                      <option value="first">第一个客户端</option>
                      <option value="specific">指定客户端</option>
                    </select>
                  </div>
                </div>

                {target === 'specific' && (
                  <div className="form-group">
                    <label>客户端 ID</label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="指定客户端 ID"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 编辑工具弹窗组件
interface EditToolModalProps {
  tool: Tool
  onClose: () => void
  onSuccess: (tool: Tool) => void
}

function EditToolModal({ tool, onClose, onSuccess }: EditToolModalProps) {
  const [description, setDescription] = useState(tool.description)
  const [handlerType, setHandlerType] = useState<'websocket' | 'skill' | 'http'>(tool.handler.type)
  // WebSocket 状态
  const [skillName, setSkillName] = useState(tool.handler.type === 'skill' ? tool.handler.skillName || '' : '')
  const [action, setAction] = useState(tool.handler.type === 'websocket' ? tool.handler.action || '' : '')
  const [timeout, setTimeout] = useState(tool.handler.timeout || 30000)
  const [target, setTarget] = useState(tool.handler.type === 'websocket' ? tool.handler.target || 'all' : 'all')
  const [clientId, setClientId] = useState(tool.handler.type === 'websocket' ? tool.handler.clientId || '' : '')
  // HTTP 状态
  const [httpUrl, setHttpUrl] = useState(tool.handler.type === 'http' ? tool.handler.url || '' : '')
  const [httpMethod, setHttpMethod] = useState(tool.handler.type === 'http' ? tool.handler.method || 'POST' : 'POST')
  const [httpHeaders, setHttpHeaders] = useState(tool.handler.type === 'http' && tool.handler.headers ? JSON.stringify(tool.handler.headers, null, 2) : '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const handler = handlerType === 'websocket'
        ? { type: 'websocket' as const, action: action || undefined, timeout }
        : handlerType === 'skill'
        ? { type: 'skill' as const, skillName }
        : {
            type: 'http' as const,
            url: httpUrl,
            method: httpMethod,
            headers: httpHeaders ? JSON.parse(httpHeaders) : undefined,
            timeout
          }

      const result = await apiClient.updateTool(tool.name, {
        description,
        handler,
      })

      onSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>编辑工具：{tool.name}</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>基本信息</h3>
            <div className="form-group">
              <label>工具名称</label>
              <input type="text" value={tool.name} disabled className="disabled-input" />
            </div>

            <div className="form-group">
              <label>描述 <span className="required">*</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Handler 配置</h3>
            <div className="form-group">
              <label>Handler 类型</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={handlerType === 'websocket'}
                    onChange={() => setHandlerType('websocket')}
                  />
                  <span>WebSocket</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={handlerType === 'skill'}
                    onChange={() => setHandlerType('skill')}
                  />
                  <span>Skill</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={handlerType === 'http'}
                    onChange={() => setHandlerType('http')}
                  />
                  <span>HTTP</span>
                </label>
              </div>
            </div>

            {handlerType === 'websocket' && (
              <div className="form-hint" style={{ background: '#fff7ed', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fed7aa', marginBottom: '16px' }}>
                <strong style={{ color: '#ea580c' }}>⚠️ 仅适用于三方系统接入</strong>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#9a3412', lineHeight: '1.6' }}>
                  WebSocket Handler 用于外部系统连接到 MCP Bridge 并执行工具。
                  需要外部系统通过 WebSocket 连接到此服务，注册工具能力，并响应 tool_request 消息。
                </p>
              </div>
            )}

            {handlerType === 'skill' ? (
              <div className="form-group">
                <label>Skill 名称 <span className="required">*</span></label>
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  required
                />
              </div>
            ) : handlerType === 'http' ? (
              <>
                <div className="form-group">
                  <label>接口 URL <span className="required">*</span></label>
                  <input
                    type="url"
                    value={httpUrl}
                    onChange={(e) => setHttpUrl(e.target.value)}
                    placeholder="https://api.example.com/endpoint"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>HTTP 方法</label>
                    <select value={httpMethod} onChange={(e) => setHttpMethod(e.target.value as any)}>
                      <option value="POST">POST</option>
                      <option value="GET">GET</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>超时时间 (ms)</label>
                    <input
                      type="number"
                      value={timeout}
                      onChange={(e) => setTimeout(Number(e.target.value))}
                      min={1000}
                      max={300000}
                      step={1000}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>自定义 Headers (JSON 格式，可选)</label>
                  <textarea
                    value={httpHeaders}
                    onChange={(e) => setHttpHeaders(e.target.value)}
                    placeholder='{"Authorization": "Bearer xxx", "X-Custom-Header": "value"}'
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>Action (可选)</label>
                  <input
                    type="text"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="客户端 action 标识"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>超时时间 (ms)</label>
                    <input
                      type="number"
                      value={timeout}
                      onChange={(e) => setTimeout(Number(e.target.value))}
                      min={1000}
                      max={300000}
                      step={1000}
                    />
                  </div>
                  <div className="form-group">
                    <label>目标策略</label>
                    <select value={target} onChange={(e) => setTarget(e.target.value as any)}>
                      <option value="all">所有客户端</option>
                      <option value="first">第一个客户端</option>
                      <option value="specific">指定客户端</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 测试工具弹窗组件
interface TestToolModalProps {
  tool: Tool
  onClose: () => void
}

function TestToolModal({ tool, onClose }: TestToolModalProps) {
  const [args, setArgs] = useState('{}')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState<number>(0)

  const handleTest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const parsedArgs = args.trim() ? JSON.parse(args) : {}
      const startTime = Date.now()
      const data = await apiClient.invokeTool(tool.name, parsedArgs)
      setResult(data.result)
      setDuration(Date.now() - startTime)
      if (data.error) {
        setError(data.error.message)
      }
    } catch (err: any) {
      setError(err.message || '测试失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>测试工具：{tool.name}</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="test-content">
          <div className="test-section">
            <h3>输入参数 (JSON)</h3>
            <textarea
              className="json-input"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder='{"key": "value"}'
              rows={6}
            />
            <div className="test-actions">
              <button
                className="btn-primary"
                onClick={handleTest}
                disabled={loading}
              >
                {loading ? '测试中...' : '🧪 执行测试'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  const props = tool.inputSchema.properties
                  const example = Object.keys(props).reduce((acc, key) => {
                    acc[key] = props[key].type === 'string' ? '' : props[key].type === 'number' ? 0 : null
                    return acc
                  }, {} as Record<string, unknown>)
                  setArgs(JSON.stringify(example, null, 2))
                }}
              >
                生成模板
              </button>
            </div>
          </div>

          {(result || error) && (
            <div className="test-section">
              <h3>测试结果</h3>
              {error ? (
                <div className="test-result error">
                  <div className="result-header">
                    <span className="status-badge failed">❌ 失败</span>
                    {duration > 0 && <span className="duration">{duration}ms</span>}
                  </div>
                  <pre className="result-content error">{error}</pre>
                </div>
              ) : (
                <div className="test-result success">
                  <div className="result-header">
                    <span className="status-badge success">✅ 成功</span>
                    {duration > 0 && <span className="duration">{duration}ms</span>}
                  </div>
                  <pre className="result-content">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
