/**
 * 创建工具弹窗
 */

import { useState } from 'react'

interface Props {
  onClose: () => void
  onCreate: (tool: {
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
  }) => void
}

export function CreateToolModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [inputSchemaStr, setInputSchemaStr] = useState('{\n  "type": "object",\n  "properties": {}\n}')
  const [action, setAction] = useState('')
  const [timeout, setTimeout] = useState(30000)
  const [error, setError] = useState('')

  const handleSubmit = () => {
    setError('')

    // 验证名称
    if (!name.trim()) {
      setError('工具名称不能为空')
      return
    }

    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      setError('工具名称必须以小写字母开头，只能包含小写字母、数字和下划线')
      return
    }

    if (!description.trim()) {
      setError('描述不能为空')
      return
    }

    // 解析 inputSchema
    let inputSchema
    try {
      inputSchema = JSON.parse(inputSchemaStr)
    } catch {
      setError('输入参数 Schema 格式错误')
      return
    }

    onCreate({
      name: name.trim(),
      description: description.trim(),
      inputSchema,
      handler: {
        type: 'websocket',
        action: action.trim() || undefined,
        timeout
      }
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>注册新工具</h2>

        {error && (
          <div style={{ padding: 12, background: '#fef2f2', color: '#dc2626', borderRadius: 6, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label>工具名称 *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如: get_weather"
          />
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            小写字母开头，只能包含小写字母、数字和下划线
          </div>
        </div>

        <div className="form-group">
          <label>描述 *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="描述这个工具的功能"
          />
        </div>

        <div className="form-group">
          <label>输入参数 Schema (JSON)</label>
          <textarea
            value={inputSchemaStr}
            onChange={e => setInputSchemaStr(e.target.value)}
            style={{ minHeight: 120 }}
          />
        </div>

        <div className="form-group">
          <label>Action (可选)</label>
          <input
            type="text"
            value={action}
            onChange={e => setAction(e.target.value)}
            placeholder="前端识别的操作类型"
          />
        </div>

        <div className="form-group">
          <label>超时时间 (毫秒)</label>
          <input
            type="number"
            value={timeout}
            onChange={e => setTimeout(Number(e.target.value))}
            min={1000}
            max={300000}
          />
        </div>

        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>取消</button>
          <button className="primary" onClick={handleSubmit}>创建</button>
        </div>
      </div>
    </div>
  )
}