/**
 * API Hook
 */

import { useState, useCallback } from 'react'

const API_BASE = '/api/tools'

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

interface MCPConfig {
  serverName: string
  serverUrl: string
  sseEndpoint: string
  claudeConfig: {
    mcpServers: {
      [key: string]: {
        url: string
      }
    }
  }
  tools: string[]
}

export function useApi() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshTools = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(API_BASE)
      const data = await response.json()
      if (data.success) {
        setTools(data.data.tools)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tools')
    } finally {
      setLoading(false)
    }
  }, [])

  const getTool = useCallback(async (name: string): Promise<Tool | null> => {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(name)}`)
      const data = await response.json()
      if (data.success) {
        return data.data
      }
      return null
    } catch {
      return null
    }
  }, [])

  const createTool = useCallback(async (tool: {
    name: string
    description: string
    inputSchema: Tool['inputSchema']
    handler: Tool['handler']
  }): Promise<{ success: boolean; tool?: Tool; mcpConfig?: MCPConfig; error?: string }> => {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tool)
      })
      const data = await response.json()
      if (data.success) {
        await refreshTools()
        return { success: true, tool: data.data.tool, mcpConfig: data.data.mcpConfig }
      }
      return { success: false, error: data.error?.message || 'Failed to create tool' }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create tool' }
    }
  }, [refreshTools])

  const updateTool = useCallback(async (name: string, updates: Partial<Tool>): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      const data = await response.json()
      if (data.success) {
        await refreshTools()
        return { success: true }
      }
      return { success: false, error: data.error?.message || 'Failed to update tool' }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update tool' }
    }
  }, [refreshTools])

  const deleteTool = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        await refreshTools()
        return { success: true }
      }
      return { success: false, error: data.error?.message || 'Failed to delete tool' }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete tool' }
    }
  }, [refreshTools])

  const invokeTool = useCallback(async (name: string, args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(name)}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      })
      const data = await response.json()
      return {
        success: data.success,
        result: data.data?.result,
        error: data.error?.message || data.data?.error?.message
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to invoke tool' }
    }
  }, [])

  const getMCPConfig = useCallback(async (): Promise<MCPConfig | null> => {
    try {
      const response = await fetch(`${API_BASE}/mcp-config`)
      const data = await response.json()
      if (data.success) {
        return data.data
      }
      return null
    } catch {
      return null
    }
  }, [])

  return {
    tools,
    loading,
    error,
    refreshTools,
    getTool,
    createTool,
    updateTool,
    deleteTool,
    invokeTool,
    getMCPConfig
  }
}