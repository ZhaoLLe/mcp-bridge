/**
 * Layout 布局组件
 * 包含顶部导航和主内容区域
 */

import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Layout.css'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="header-content">
          <Link to="/" className="logo">
            <span className="logo-icon">🔗</span>
            <span className="logo-text">MCP Bridge</span>
          </Link>
          <nav className="main-nav">
            <Link
              to="/tools"
              className={`nav-item ${isActive('/tools') ? 'active' : ''}`}
            >
              工具管理
            </Link>
            <Link
              to="/skills"
              className={`nav-item ${isActive('/skills') ? 'active' : ''}`}
            >
              Skill 编排
            </Link>
            <Link
              to="/logs"
              className={`nav-item ${isActive('/logs') ? 'active' : ''}`}
            >
              调用日志
            </Link>
          </nav>
        </div>
      </header>
      <main className="layout-main">
        <div className="main-content">
          {children}
        </div>
      </main>
      <footer className="layout-footer">
        <p>MCP Bridge v1.0.0 - 动态 MCP 服务桥接</p>
      </footer>
    </div>
  )
}
