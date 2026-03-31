/**
 * 调用日志页面
 */

import React, { useState, useEffect } from 'react'
import { apiClient, type InvokeLog, type LogStats } from '../services/api'
import './LogsPage.css'

export function LogsPage() {
  const [logs, setLogs] = useState<InvokeLog[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<'all' | 'tool' | 'skill'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'timeout'>('all')
  const [selectedLog, setSelectedLog] = useState<InvokeLog | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [logsData, statsData] = await Promise.all([
        apiClient.getLogs({
          type: typeFilter !== 'all' ? typeFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          pageSize: 50,
        }),
        apiClient.getLogStats(),
      ])
      setLogs(logsData.logs)
      setStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [typeFilter, statusFilter])

  const handleClear = async () => {
    if (!confirm('确定要清空所有日志吗？此操作不可恢复！')) return
    try {
      await apiClient.clearLogs()
      setLogs([])
      setStats(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  return (
    <div className="logs-page">
      <div className="page-header">
        <h1>调用日志</h1>
        <button className="btn-danger" onClick={handleClear}>
          清空日志
        </button>
      </div>

      {stats && (
        <div className="stats-grid">
          <StatCard label="总调用数" value={stats.total} color="#667eea" />
          <StatCard label="成功率" value={`${stats.successRate}%`} color="#10b981" />
          <StatCard label="平均耗时" value={formatDuration(stats.avgDuration)} color="#764ba2" />
          <StatCard label="最近 24 小时" value={stats.last24HoursCount} color="#f59e0b" />
          <StatCard label="Tool 调用" value={stats.toolCount} color="#3b82f6" />
          <StatCard label="Skill 调用" value={stats.skillCount} color="#ec4899" />
        </div>
      )}

      <div className="filters-bar">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="filter-select"
        >
          <option value="all">全部类型</option>
          <option value="tool">Tool</option>
          <option value="skill">Skill</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="filter-select"
        >
          <option value="all">全部状态</option>
          <option value="success">成功</option>
          <option value="failed">失败</option>
          <option value="timeout">超时</option>
        </select>
        <button className="btn-secondary" onClick={loadData}>
          刷新
        </button>
      </div>

      <div className="logs-content">
        <div className="logs-list-panel">
          <h2>日志列表</h2>
          {loading ? (
            <div className="loading">加载中...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">暂无日志</div>
          ) : (
            <ul className="logs-list">
              {logs.map(log => (
                <li
                  key={log.id}
                  className={`log-item ${selectedLog?.id === log.id ? 'selected' : ''}`}
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="log-main">
                    <span className={`status-dot ${log.status}`}></span>
                    <span className="log-type">{log.type}</span>
                    <span className="log-name">{log.name}</span>
                  </div>
                  <div className="log-meta">
                    <span className="log-duration">{formatDuration(log.duration)}</span>
                    <span className="log-time">{formatTime(log.timestamp)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="log-detail-panel">
          {selectedLog ? (
            <LogDetail log={selectedLog} formatDuration={formatDuration} formatTime={formatTime} />
          ) : (
            <div className="empty-state">
              <p>选择一条日志查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 统计卡片组件
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
    </div>
  )
}

// 日志详情组件
interface LogDetailProps {
  log: InvokeLog
  formatDuration: (ms: number) => string
  formatTime: (timestamp: number) => string
}

function LogDetail({ log, formatDuration, formatTime }: LogDetailProps) {
  return (
    <>
      <h2>日志详情</h2>
      <div className="detail-content">
        <div className="detail-row">
          <label>ID:</label>
          <span className="mono">{log.id}</span>
        </div>
        <div className="detail-row">
          <label>类型:</label>
          <span className="type-badge">{log.type}</span>
        </div>
        <div className="detail-row">
          <label>名称:</label>
          <span>{log.name}</span>
        </div>
        {log.skillId && (
          <div className="detail-row">
            <label>Skill ID:</label>
            <span className="mono">{log.skillId}</span>
          </div>
        )}
        <div className="detail-row">
          <label>状态:</label>
          <span className={`status-badge ${log.status}`}>
            {log.status === 'success' ? '✅ 成功' : log.status === 'failed' ? '❌ 失败' : '⏱️ 超时'}
          </span>
        </div>
        <div className="detail-row">
          <label>耗时:</label>
          <span>{formatDuration(log.duration)}</span>
        </div>
        <div className="detail-row">
          <label>时间:</label>
          <span>{formatTime(log.timestamp)}</span>
        </div>
        <div className="detail-row">
          <label>输入参数:</label>
          <pre className="data-block">{JSON.stringify(log.arguments, null, 2)}</pre>
        </div>
        {log.result !== undefined && (
          <div className="detail-row">
            <label>返回结果:</label>
            <pre className="data-block">{JSON.stringify(log.result, null, 2)}</pre>
          </div>
        )}
        {log.error && (
          <div className="detail-row">
            <label>错误信息:</label>
            <pre className="data-block error">{JSON.stringify(log.error, null, 2)}</pre>
          </div>
        )}
        {log.subCalls && log.subCalls.length > 0 && (
          <div className="detail-row">
            <label>子调用 ({log.subCalls.length}):</label>
            <div className="sub-calls">
              {log.subCalls.map((sub, i) => (
                <div key={i} className="sub-call">
                  <span className="sub-type">{sub.type}</span>
                  <span className="sub-name">{sub.name}</span>
                  <span className={`sub-status ${sub.status}`}>{sub.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
