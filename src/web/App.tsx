/**
 * MCP Bridge Web UI 主应用
 */

import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout/Layout'
import { HomePage } from './pages/HomePage'
import { ToolsPage } from './pages/ToolsPage'
import { SkillsPage } from './pages/SkillsPage'
import { SkillEditorPage } from './pages/SkillEditorPage'
import { LogsPage } from './pages/LogsPage'
import './styles.css'

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/skills/new" element={<SkillEditorPage />} />
          <Route path="/skills/editor/:skillName" element={<SkillEditorPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
