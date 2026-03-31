/**
 * 首页（重定向到 Tools 页面）
 */

import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function HomePage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/tools')
  }, [navigate])

  return (
    <div className="home-page">
      <div className="loading">
        <p>正在跳转...</p>
      </div>
    </div>
  )
}
