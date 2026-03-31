/**
 * Skills 管理页面
 */

import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { apiClient, type Skill } from '../services/api'
import './SkillsPage.css'

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeMenu && !(e.target as Element).closest('.skill-menu-container')) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeMenu])

  const loadSkills = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.getSkills({
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      setSkills(data.skills)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSkills()
  }, [search, statusFilter])

  const handleDelete = async (name: string) => {
    if (!confirm(`确定要删除 Skill "${name}" 吗？`)) return
    try {
      await apiClient.deleteSkill(name)
      setSkills(skills.filter(s => s.name !== name))
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    }
  }

  const handleToggleStatus = async (name: string) => {
    try {
      const updated = await apiClient.toggleSkillStatus(name)
      setSkills(skills.map(s => s.name === name ? updated : s))
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    }
  }

  const handleDownloadSkillMd = async (name: string) => {
    try {
      const blob = await apiClient.downloadSkillMd(name)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'SKILL.md'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : '下载失败')
    }
  }

  const handleDownloadPrompt = async (name: string) => {
    try {
      const blob = await apiClient.downloadPromptTemplate(name)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'PROMPT.txt'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : '下载失败')
    }
  }

  return (
    <div className="skills-page">
      <div className="page-header">
        <h1>Skill 编排</h1>
        <Link to="/skills/new" className="btn-primary">
          + 创建 Skill
        </Link>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          className="search-input"
          placeholder="搜索 Skill..."
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
        <button className="btn-secondary" onClick={loadSkills}>
          刷新
        </button>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : skills.length === 0 ? (
        <div className="empty-state">
          <p>暂无 Skill</p>
          <Link to="/skills/new" className="btn-primary">
            创建第一个 Skill
          </Link>
        </div>
      ) : (
        <div className="skills-grid">
          {skills.map(skill => (
            <div key={skill.id} className="skill-card">
              <div className="skill-menu-container">
                <button
                  className="skill-menu-btn"
                  onClick={() => setActiveMenu(activeMenu === skill.id ? null : skill.id)}
                >
                  ⋮
                </button>
                {activeMenu === skill.id && (
                  <div className="skill-menu-dropdown">
                    <Link to={`/skills/editor/${skill.name}`} className="menu-item">
                      <span className="menu-icon">✏️</span>
                      编辑流程
                    </Link>
                    <button className="menu-item" onClick={() => { handleDownloadSkillMd(skill.name); setActiveMenu(null); }}>
                      <span className="menu-icon">📄</span>
                      下载 SKILL.md
                    </button>
                    {skill.exposeModes.asPrompt && (
                      <button className="menu-item" onClick={() => { handleDownloadPrompt(skill.name); setActiveMenu(null); }}>
                        <span className="menu-icon">📝</span>
                        下载 Prompt
                      </button>
                    )}
                    <button className="menu-item" onClick={() => { handleToggleStatus(skill.name); setActiveMenu(null); }}>
                      <span className="menu-icon">{skill.status === 'enabled' ? '✕' : '✓'}</span>
                      {skill.status === 'enabled' ? '禁用' : '启用'}
                    </button>
                    <div className="menu-divider"></div>
                    <button className="menu-item danger" onClick={() => { handleDelete(skill.name); setActiveMenu(null); }}>
                      <span className="menu-icon">🗑️</span>
                      删除
                    </button>
                  </div>
                )}
              </div>
              <div className="skill-header">
                <div className="skill-title">
                  <h3>{skill.displayName}</h3>
                  <span className={`status-badge ${skill.status}`}>
                    {skill.status === 'enabled' ? '●' : '○'}
                  </span>
                </div>
                <span className="skill-name">{skill.name}</span>
              </div>
              <p className="skill-description">{skill.description}</p>
              <div className="skill-meta">
                <div className="trigger-phrases">
                  <label>触发短语:</label>
                  <div className="phrases-list">
                    {skill.triggerPhrases.slice(0, 3).map((phrase, i) => (
                      <span key={i} className="phrase-tag">{phrase}</span>
                    ))}
                    {skill.triggerPhrases.length > 3 && (
                      <span className="phrase-more">+{skill.triggerPhrases.length - 3}</span>
                    )}
                  </div>
                </div>
                <div className="expose-modes">
                  <label>暴露模式:</label>
                  <div className="modes-list">
                    {skill.exposeModes.asSkill && <span className="mode-tag">Skill</span>}
                    {skill.exposeModes.asTool && <span className="mode-tag">Tool</span>}
                    {skill.exposeModes.asPrompt && <span className="mode-tag">Prompt</span>}
                  </div>
                </div>
              </div>
              <div className="skill-nodes-count">
                <span>{skill.nodes.length} 个节点</span>
                <span>{skill.edges.length} 条边</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
