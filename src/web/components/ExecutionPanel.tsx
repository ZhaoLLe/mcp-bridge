/**
 * 执行面板
 */

interface ToolRequest {
  requestId: string
  tool: string
  action?: string
  arguments: Record<string, unknown>
  timeout: number
}

interface Props {
  requests: ToolRequest[]
  onRespond: (requestId: string, success: boolean, result?: unknown) => void
}

export function ExecutionPanel({ requests, onRespond }: Props) {
  const [resultInputs, setResultInputs] = useState<Record<string, string>>({})

  if (requests.length === 0) {
    return (
      <div className="panel full-width execution-panel">
        <h2>执行面板</h2>
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div>等待 Claude 调用工具...</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>当 Claude 调用工具时，会在这里显示执行请求</div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel full-width execution-panel">
      <h2>执行面板 ({requests.length} 个待处理)</h2>

      {requests.map(request => (
        <div key={request.requestId} className="request-card">
          <div className="request-header">
            <div>
              <strong>{request.tool}</strong>
              {request.action && <span style={{ color: '#6b7280', marginLeft: 8 }}>/ {request.action}</span>}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              超时: {request.timeout / 1000}s
            </div>
          </div>

          <div className="request-body">
            {JSON.stringify(request.arguments, null, 2)}
          </div>

          <div className="form-group">
            <label>返回结果 (JSON)</label>
            <textarea
              value={resultInputs[request.requestId] || '{}'}
              onChange={(e) => setResultInputs(prev => ({
                ...prev,
                [request.requestId]: e.target.value
              }))}
              placeholder='{"result": "value"}'
              style={{ minHeight: 80 }}
            />
          </div>

          <div className="request-actions">
            <button
              className="primary"
              onClick={() => {
                try {
                  const result = JSON.parse(resultInputs[request.requestId] || '{}')
                  onRespond(request.requestId, true, result)
                } catch {
                  onRespond(request.requestId, true, resultInputs[request.requestId])
                }
              }}
            >
              返回成功
            </button>
            <button
              className="danger"
              onClick={() => onRespond(request.requestId, false, { error: 'Rejected by user' })}
            >
              返回失败
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}