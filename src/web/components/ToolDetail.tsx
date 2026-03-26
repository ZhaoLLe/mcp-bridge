/**
 * 工具详情面板
 */

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
  tool: Tool | null
  onInvoke: (args: Record<string, unknown>) => void
}

export function ToolDetail({ tool, onInvoke }: Props) {
  if (!tool) {
    return (
      <div className="panel">
        <h2>工具详情</h2>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          选择一个工具查看详情
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <h2>工具详情</h2>

      <div className="form-group">
        <label>名称</label>
        <input type="text" value={tool.name} disabled />
      </div>

      <div className="form-group">
        <label>描述</label>
        <textarea value={tool.description} disabled />
      </div>

      <div className="form-group">
        <label>输入参数 Schema</label>
        <textarea
          value={JSON.stringify(tool.inputSchema, null, 2)}
          disabled
          style={{ minHeight: 120 }}
        />
      </div>

      <div className="form-group">
        <label>Handler 配置</label>
        <textarea
          value={JSON.stringify(tool.handler, null, 2)}
          disabled
          style={{ minHeight: 80 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          className="primary"
          onClick={() => {
            // 简单测试：使用空参数调用
            onInvoke({})
          }}
        >
          测试调用
        </button>
      </div>
    </div>
  )
}