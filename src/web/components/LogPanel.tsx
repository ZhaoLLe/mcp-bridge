/**
 * 日志面板
 */

interface LogEntry {
  id: number
  timestamp: string
  type: string
  data: unknown
}

interface Props {
  logs: LogEntry[]
}

export function LogPanel({ logs }: Props) {
  return (
    <div className="panel full-width log-panel">
      <h2>调用日志</h2>

      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af' }}>
          暂无日志
        </div>
      ) : (
        logs.map(log => (
          <div key={log.id} className="log-entry">
            <span className="time">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="type">{log.type}</span>
            <span className="data">
              {typeof log.data === 'string' ? log.data : JSON.stringify(log.data).slice(0, 100)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}