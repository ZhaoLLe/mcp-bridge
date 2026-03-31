/**
 * Skill 编辑器页面 - 流程编排
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { apiClient, type Skill, type SkillNode, type SkillEdge, type CreateSkillRequest, type Tool } from '../services/api'
import './SkillEditorPage.css'

export function SkillEditorPage() {
  const { skillName } = useParams<{ skillName: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const isNew = !skillName || location.pathname === '/skills/new'

  const [loading, setLoading] = useState(isNew ? false : true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    triggerPhrases: [''],
    asSkill: true,
    asTool: false,
    asPrompt: false,
  })

  // 流程编排状态
  const [availableTools, setAvailableTools] = useState<Tool[]>([])
  const [nodes, setNodes] = useState<SkillNode[]>([])
  const [edges, setEdges] = useState<SkillEdge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showToolSelector, setShowToolSelector] = useState(false)

  // 加载工具和 Skill
  useEffect(() => {
    loadTools()
    if (!isNew && skillName) {
      loadSkill(skillName)
    } else if (isNew) {
      initDefaultFlow()
    }
  }, [skillName, isNew])

  const loadTools = async () => {
    try {
      const tools = await apiClient.getTools()
      setAvailableTools(tools)
    } catch (err) {
      console.error('Failed to load tools:', err)
    }
  }

  const loadSkill = async (name: string) => {
    setLoading(true)
    setError(null)
    try {
      const skill = await apiClient.getSkill(name)
      setFormData({
        name: skill.name,
        displayName: skill.displayName,
        description: skill.description,
        triggerPhrases: skill.triggerPhrases.length > 0 ? skill.triggerPhrases : [''],
        asSkill: skill.exposeModes.asSkill,
        asTool: skill.exposeModes.asTool,
        asPrompt: skill.exposeModes.asPrompt,
      })
      setNodes(skill.nodes || [])
      setEdges(skill.edges || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const initDefaultFlow = () => {
    const startNode: SkillNode = {
      id: 'start',
      type: 'start',
      name: '开始',
      config: {},
      position: { x: 100, y: 100 },
    }
    const endNode: SkillNode = {
      id: 'end',
      type: 'end',
      name: '结束',
      config: {},
      position: { x: 100, y: 300 },
    }
    const startEdge: SkillEdge = {
      id: 'edge-start-end',
      source: 'start',
      target: 'end',
    }
    setNodes([startNode, endNode])
    setEdges([startEdge])
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleTriggerPhraseChange = (index: number, value: string) => {
    const newPhrases = [...formData.triggerPhrases]
    newPhrases[index] = value
    setFormData(prev => ({ ...prev, triggerPhrases: newPhrases }))
  }

  const addTriggerPhrase = () => {
    setFormData(prev => ({ ...prev, triggerPhrases: [...prev.triggerPhrases, ''] }))
  }

  const removeTriggerPhrase = (index: number) => {
    if (formData.triggerPhrases.length === 1) return
    const newPhrases = formData.triggerPhrases.filter((_, i) => i !== index)
    setFormData(prev => ({ ...prev, triggerPhrases: newPhrases }))
  }

  // 添加工具节点
  const addToolNode = (tool: Tool) => {
    const nodeId = `tool-${Date.now()}`

    // 自动构建 inputMapping：如果 tool 是第一个节点，尝试自动映射
    const isFirstChild = nodes.filter(n => n.type === 'tool').length === 0
    const autoInputMapping: Record<string, string> = {}

    if (isFirstChild) {
      // 对于每个工具参数，自动创建映射到 ${input.参数名}
      // 用户可以在配置面板中修改
      const toolParams = tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties) : []

      for (const param of toolParams) {
        // 默认假设参数来自 input，用户在配置面板中可以修改
        autoInputMapping[param] = `\${input.${param}}`
      }
    }

    const toolNode: SkillNode = {
      id: nodeId,
      type: 'tool',
      name: tool.name,
      config: {
        toolName: tool.name,
        inputMapping: autoInputMapping,
      },
      position: { x: 200, y: 100 + (nodes.filter(n => n.type === 'tool').length + 1) * 120 },
    }

    const endNode = nodes.find(n => n.type === 'end')
    const toolNodes = nodes.filter(n => n.type === 'tool')
    const lastToolNode = toolNodes.length > 0 ? toolNodes[toolNodes.length - 1] : null

    const newNodes = [...nodes.filter(n => n.type !== 'end'), toolNode, endNode!]

    // 重新构建所有边，确保连接正确
    const newEdges: SkillEdge[] = []
    const allToolNodes = newNodes.filter(n => n.type === 'tool')

    // start -> 第一个 tool 节点
    if (allToolNodes.length > 0) {
      newEdges.push({
        id: `edge-start-${allToolNodes[0].id}`,
        source: 'start',
        target: allToolNodes[0].id
      })
    }

    // tool 节点之间的连接
    for (let i = 0; i < allToolNodes.length - 1; i++) {
      newEdges.push({
        id: `edge-${allToolNodes[i].id}-${allToolNodes[i+1].id}`,
        source: allToolNodes[i].id,
        target: allToolNodes[i+1].id
      })
    }

    // 最后一个 tool 节点 -> end
    if (allToolNodes.length > 0 && endNode) {
      newEdges.push({
        id: `edge-${allToolNodes[allToolNodes.length-1].id}-end`,
        source: allToolNodes[allToolNodes.length-1].id,
        target: 'end'
      })
    }

    setNodes(newNodes)
    setEdges(newEdges)
    setShowToolSelector(false)
  }

  // 删除节点
  const removeNode = (nodeId: string) => {
    if (nodeId === 'start' || nodeId === 'end') return

    const toolNodes = nodes.filter(n => n.type === 'tool')
    const currentIndex = toolNodes.findIndex(n => n.id === nodeId)
    const prevNode = currentIndex > 0 ? toolNodes[currentIndex - 1] : nodes.find(n => n.type === 'start')
    const nextNode = currentIndex < toolNodes.length - 1 ? toolNodes[currentIndex + 1] : nodes.find(n => n.type === 'end')

    const newNodes = nodes.filter(n => n.id !== nodeId)
    const newEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId)

    if (prevNode && nextNode) {
      newEdges.push({ id: `edge-${prevNode.id}-${nextNode.id}`, source: prevNode.id, target: nextNode.id })
    }

    setNodes(newNodes)
    setEdges(newEdges)
    setSelectedNodeId(null)
  }

  // 移动节点
  const moveNode = (nodeId: string, direction: 'up' | 'down') => {
    const toolNodes = nodes.filter(n => n.type === 'tool')
    const currentIndex = toolNodes.findIndex(n => n.id === nodeId)
    if (currentIndex === -1) return

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (swapIndex < 0 || swapIndex >= toolNodes.length) return

    const newToolNodes = [...toolNodes]
    ;[newToolNodes[currentIndex], newToolNodes[swapIndex]] = [newToolNodes[swapIndex], newToolNodes[currentIndex]]

    const startNode = nodes.find(n => n.type === 'start')
    const endNode = nodes.find(n => n.type === 'end')
    const newNodes = [startNode!, ...newToolNodes, endNode!]

    const newEdges: SkillEdge[] = []
    for (let i = 0; i < newNodes.length - 1; i++) {
      newEdges.push({ id: `edge-${newNodes[i].id}-${newNodes[i + 1].id}`, source: newNodes[i].id, target: newNodes[i + 1].id })
    }

    setNodes(newNodes)
    setEdges(newEdges)
  }

  // 获取工具节点列表
  const toolNodes = nodes.filter(n => n.type === 'tool')

  if (loading) {
    return (
      <div className="skill-editor-page">
        <div className="loading">加载中...</div>
      </div>
    )
  }

  return (
    <div className="skill-editor-page">
      <div className="page-header">
        <h1>{isNew ? '创建 Skill' : `编辑 Skill: ${skillName}`}</h1>
        <div className="header-actions">
          {!isNew && skillName && (
            <>
              <button type="button" className="btn-secondary" onClick={() => downloadSkillMd(skillName)}>
                下载 SKILL.md
              </button>
              <button type="button" className="btn-secondary" onClick={() => downloadPromptTemplate(skillName)}>
                下载 Prompt
              </button>
            </>
          )}
          <Link to="/skills" className="btn-secondary">返回列表</Link>
          <button type="button" className="btn-primary" onClick={() => document.querySelector('form')?.requestSubmit()}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="editor-layout">
        {/* 左侧：基本信息表单 */}
        <div className="editor-sidebar">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e) }}>
            <div className="form-section">
              <h3>基本信息</h3>
              {isNew && (
                <div className="form-group">
                  <label>名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="例如：weekend-recommend"
                    required
                    pattern="[a-z][a-z0-9_]*"
                  />
                  <p className="form-hint">只能包含小写字母、数字和下划线</p>
                </div>
              )}
              <div className="form-group">
                <label>显示名称 *</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  placeholder="例如：周末活动推荐"
                  required
                />
              </div>
              <div className="form-group">
                <label>描述 *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="描述这个 Skill 的用途..."
                  required
                  rows={3}
                />
              </div>
            </div>

            <div className="form-section">
              <h3>触发配置</h3>
              <div className="form-group">
                <label>触发短语</label>
                <div className="trigger-phrases-input">
                  {formData.triggerPhrases.map((phrase, index) => (
                    <div key={index} className="trigger-phrase-row">
                      <input
                        type="text"
                        value={phrase}
                        onChange={(e) => handleTriggerPhraseChange(index, e.target.value)}
                        placeholder="例如：推荐周末活动"
                      />
                      <button type="button" className="btn-remove-phrase" onClick={() => removeTriggerPhrase(index)}>×</button>
                    </div>
                  ))}
                  <button type="button" className="btn-add-phrase" onClick={addTriggerPhrase}>+ 添加触发短语</button>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>暴露模式</h3>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={formData.asSkill} onChange={(e) => handleInputChange('asSkill', e.target.checked)} />
                  <span><strong>asSkill</strong> - 生成 SKILL.md，Claude 自动触发</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={formData.asTool} onChange={(e) => handleInputChange('asTool', e.target.checked)} />
                  <span><strong>asTool</strong> - 注册为 MCP Tool</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={formData.asPrompt} onChange={(e) => handleInputChange('asPrompt', e.target.checked)} />
                  <span><strong>asPrompt</strong> - 生成 Prompt 模板</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        {/* 中间：流程编排画布 */}
        <div className="editor-canvas">
          <div className="canvas-header">
            <h3>流程编排</h3>
            <button type="button" className="btn-add-tool" onClick={() => setShowToolSelector(true)}>
              + 添加节点
            </button>
          </div>

          <div className="flow-canvas">
            {nodes.map((node, index) => {
              const isSelected = selectedNodeId === node.id
              const isToolNode = node.type === 'tool'
              const toolIndex = toolNodes.findIndex(n => n.id === node.id)

              return (
                <div key={node.id} className={`flow-node node-${node.type} ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedNodeId(node.id)}>
                  <div className="node-icon">
                    {node.type === 'start' && '▶'}
                    {node.type === 'end' && '■'}
                    {node.type === 'tool' && '🔧'}
                  </div>
                  <div className="node-content">
                    <div className="node-name">{node.name}</div>
                    {isToolNode && (
                      <div className="node-detail">{node.config.toolName}</div>
                    )}
                  </div>
                  {isToolNode && (
                    <div className="node-actions">
                      <button type="button" className="btn-node-move" onClick={(e) => { e.stopPropagation(); moveNode(node.id, 'up') }} disabled={toolIndex === 0}>↑</button>
                      <button type="button" className="btn-node-move" onClick={(e) => { e.stopPropagation(); moveNode(node.id, 'down') }} disabled={toolIndex === toolNodes.length - 1}>↓</button>
                      <button type="button" className="btn-node-delete" onClick={(e) => { e.stopPropagation(); removeNode(node.id) }}>×</button>
                    </div>
                  )}
                  {index < nodes.length - 1 && <div className="node-connector">↓</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* 右侧：节点配置面板 */}
        <div className="editor-config-panel">
          {selectedNodeId ? (
            <NodeConfigPanel
              key={selectedNodeId}
              node={nodes.find(n => n.id === selectedNodeId)!}
              tools={availableTools}
              nodes={nodes}
              skillInputSchema={{ type: 'object', properties: {} }}
              onUpdate={(config) => updateNodeConfig(selectedNodeId, config)}
              onClose={() => setSelectedNodeId(null)}
            />
          ) : (
            <div className="config-empty">
              <p>点击节点查看配置</p>
            </div>
          )}
        </div>
      </div>

      {/* 工具选择器 */}
      {showToolSelector && (
        <div className="modal-overlay" onClick={() => setShowToolSelector(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>选择工具</h3>
              <button className="btn-modal-close" onClick={() => setShowToolSelector(false)}>×</button>
            </div>
            <div className="modal-body">
              {availableTools.length === 0 ? (
                <div className="empty-tools">
                  <p>暂无可用工具</p>
                  <p className="hint">请先在工具管理页面创建工具</p>
                </div>
              ) : (
                <div className="tool-list">
                  {availableTools.map(tool => (
                    <div key={tool.name} className="tool-item" onClick={() => addToolNode(tool)}>
                      <div className="tool-info">
                        <h4>{tool.name}</h4>
                        <p>{tool.description}</p>
                      </div>
                      <span className="tool-add-btn">+</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  function updateNodeConfig(nodeId: string, config: Partial<SkillNode['config']>) {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const triggerPhrases = formData.triggerPhrases.filter(p => p.trim())
      const finalNodes = nodes.length > 0 ? nodes : ensureDefaultFlow()
      const finalEdges = edges.length > 0 ? edges : ensureDefaultEdges(finalNodes)

      if (isNew) {
        const createData: CreateSkillRequest = {
          name: formData.name,
          displayName: formData.displayName,
          description: formData.description,
          triggerPhrases,
          exposeModes: {
            asSkill: formData.asSkill,
            asTool: formData.asTool,
            asPrompt: formData.asPrompt,
          },
          inputSchema: { type: 'object', properties: {} },
          nodes: finalNodes,
          edges: finalEdges,
        }
        apiClient.createSkill(createData).then(created => {
          alert(`Skill "${created.displayName}" 创建成功！`)
          navigate(`/skills/editor/${created.name}`)
        }).catch(err => {
          setError(err instanceof Error ? err.message : '操作失败')
        }).finally(() => setSaving(false))
      } else {
        apiClient.updateSkill(formData.name, {
          displayName: formData.displayName,
          description: formData.description,
          triggerPhrases,
          exposeModes: {
            asSkill: formData.asSkill,
            asTool: formData.asTool,
            asPrompt: formData.asPrompt,
          },
          nodes: finalNodes,
          edges: finalEdges,
        }).then(() => {
          alert('Skill 更新成功！')
        }).catch(err => {
          setError(err instanceof Error ? err.message : '操作失败')
        }).finally(() => setSaving(false))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
      setSaving(false)
    }
  }

  function ensureDefaultFlow() {
    return [
      { id: 'start', type: 'start' as const, name: '开始', config: {}, position: { x: 100, y: 100 } },
      { id: 'end', type: 'end' as const, name: '结束', config: {}, position: { x: 100, y: 300 } },
    ]
  }

  function ensureDefaultEdges(currentNodes: SkillNode[]) {
    const defaultEdges: SkillEdge[] = []
    for (let i = 0; i < currentNodes.length - 1; i++) {
      defaultEdges.push({ id: `edge-${currentNodes[i].id}-${currentNodes[i + 1].id}`, source: currentNodes[i].id, target: currentNodes[i + 1].id })
    }
    return defaultEdges
  }

  async function downloadSkillMd(name: string) {
    try {
      const md = await apiClient.getSkillMd(name)
      const blob = new Blob([md], { type: 'text/markdown' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'SKILL.md'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('下载失败：' + (err instanceof Error ? err.message : '未知错误'))
    }
  }

  async function downloadPromptTemplate(name: string) {
    try {
      const prompt = await apiClient.getPromptTemplate(name)
      const blob = new Blob([prompt], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'PROMPT.txt'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('下载失败：' + (err instanceof Error ? err.message : '未知错误'))
    }
  }
}

// 节点配置面板组件
function NodeConfigPanel({
  node,
  tools,
  nodes,
  skillInputSchema,
  onUpdate,
  onClose,
}: {
  node: SkillNode
  tools: Tool[]
  nodes?: SkillNode[]
  skillInputSchema?: { type: string; properties: Record<string, unknown> }
  onUpdate: (config: Partial<SkillNode['config']>) => void
  onClose: () => void
}) {
  const currentTool = node.type === 'tool' ? tools.find(t => t.name === node.config.toolName) : null
  const toolParams = currentTool?.inputSchema?.properties ? Object.keys(currentTool.inputSchema.properties) : []
  const [newParamKey, setNewParamKey] = useState('')
  const [newParamValue, setNewParamValue] = useState('')

  // 直接使用节点的 inputMapping，不维护本地状态
  const inputMapping = node.config.inputMapping || {}

  // 获取 outputMapping（end 节点使用）
  const outputMapping = node.config.outputMapping || {}
  const [newOutputKey, setNewOutputKey] = useState('')
  const [newOutputValue, setNewOutputValue] = useState('')

  // 获取所有 tool 节点用于输出映射源
  const toolNodes = (nodes || []).filter(n => n.type === 'tool')

  // 获取当前节点之前的所有数据源（用于下拉选择）
  const currentIndex = nodes?.findIndex(n => n.id === node.id) ?? -1
  const prevNodes = (nodes || []).slice(0, currentIndex).filter(n => n.type === 'tool')
  const hasInput = node.type === 'tool' && currentIndex > 0 // tool 节点且在 start 之后

  // 构建数据源选项
  const dataSourceOptions: Array<{ value: string; label: string; type: 'input' | 'node' }> = []
  if (hasInput) {
    dataSourceOptions.push({ value: 'input', label: 'Skill 输入', type: 'input' })
  }
  prevNodes.forEach((n, idx) => {
    dataSourceOptions.push({
      value: n.id,
      label: `${idx + 1}. ${n.name} (${n.config.toolName})`,
      type: 'node'
    })
  })

  // 获取上一个节点的输出字段（用于 end 节点）
  const lastToolNode = toolNodes.length > 0 ? toolNodes[toolNodes.length - 1] : null
  const lastToolIndex = nodes?.findIndex(n => n.id === lastToolNode?.id) ?? -1
  const isLastTool = node.type === 'end' && lastToolNode

  const handleAddMapping = () => {
    if (!newParamKey || newParamKey in inputMapping) return
    onUpdate({ inputMapping: { ...inputMapping, [newParamKey]: newParamValue } })
    setNewParamKey('')
    setNewParamValue('')
  }

  const handleUpdateMappingValue = (key: string, value: string) => {
    onUpdate({ inputMapping: { ...inputMapping, [key]: value } })
  }

  const handleRemoveMapping = (key: string) => {
    const updated = { ...inputMapping }
    delete updated[key]
    onUpdate({ inputMapping: updated })
  }

  const handleAddOutputMapping = () => {
    if (!newOutputKey || newOutputKey in outputMapping) return
    onUpdate({ outputMapping: { ...outputMapping, [newOutputKey]: newOutputValue } })
    setNewOutputKey('')
    setNewOutputValue('')
  }

  const handleUpdateOutputMappingValue = (key: string, value: string) => {
    onUpdate({ outputMapping: { ...outputMapping, [key]: value } })
  }

  const handleRemoveOutputMapping = (key: string) => {
    const updated = { ...outputMapping }
    delete updated[key]
    onUpdate({ outputMapping: updated })
  }

  const handleSave = () => {
    onClose()
  }

  // 插入表达式到输入框
  const insertExpression = (setter: (v: string) => void, sourceId: string, field?: string) => {
    const expression = field ? `\${${sourceId}.${field}}` : `\${${sourceId}}`
    setter(expression)
  }

  return (
    <div className="config-panel">
      <div className="config-header">
        <h4>{node.name}</h4>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>
      <div className="config-body">
        {node.type === 'tool' && (
          <>
            <div className="config-group">
              <label>工具</label>
              <div className="config-value">{node.config.toolName}</div>
            </div>

            {currentTool && (
              <div className="config-group">
                <label>工具参数</label>
                <div className="tool-params">
                  {toolParams.map(param => (
                    <div key={param} className="param-tag">
                      {param}
                      {currentTool.inputSchema?.required?.includes(param) && (
                        <span className="required-mark">*</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="config-group">
              <label>输入映射</label>
              <p className="config-hint">
                将 Skill 输入或前序节点输出映射到工具参数
              </p>

              <div className="input-mapping-editor">
                {Object.entries(inputMapping).map(([key, value]) => (
                  <div key={key} className="mapping-row">
                    <input
                      type="text"
                      value={key}
                      className="mapping-key"
                      disabled
                      placeholder="工具参数"
                    />
                    <span className="mapping-arrow">→</span>
                    <input
                      type="text"
                      value={value}
                      className="mapping-value"
                      onChange={(e) => handleUpdateMappingValue(key, e.target.value)}
                      placeholder="值"
                    />
                    <button
                      type="button"
                      className="btn-remove-mapping"
                      onClick={() => handleRemoveMapping(key)}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className="mapping-add-row">
                  <select
                    value={newParamKey}
                    onChange={(e) => setNewParamKey(e.target.value)}
                    className="mapping-param-select"
                  >
                    <option value="">选择参数...</option>
                    {toolParams
                      .filter(p => !(p in inputMapping))
                      .map(param => (
                        <option key={param} value={param}>{param}</option>
                      ))
                    }
                  </select>

                  {/* 数据源选择下拉框 */}
                  {dataSourceOptions.length > 0 && (
                    <select
                      className="mapping-source-select"
                      value=""
                      onChange={(e) => {
                        const source = dataSourceOptions.find(opt => opt.value === e.target.value)
                        if (source) {
                          if (source.type === 'input') {
                            // Skill 输入，尝试从 inputSchema 获取字段
                            const fields = Object.keys(skillInputSchema?.properties || {})
                            if (fields.length > 0) {
                              insertExpression(setNewParamValue, 'input', fields[0])
                            } else {
                              insertExpression(setNewParamValue, 'input')
                            }
                          } else {
                            // 节点输出，使用通用字段名 (message/result/data)
                            // 因为工具的 output 在运行时才知道
                            const sourceNode = prevNodes.find(n => n.id === source.value)
                            const sourceTool = tools.find(t => t.name === sourceNode?.config.toolName)
                            // 尝试从 outputSchema 获取字段
                            const outputFields = sourceTool?.outputSchema?.properties
                              ? Object.keys(sourceTool.outputSchema.properties)
                              : []
                            if (outputFields.length > 0) {
                              insertExpression(setNewParamValue, source.value, outputFields[0])
                            } else {
                              // 默认使用常见字段名
                              insertExpression(setNewParamValue, source.value, 'message')
                            }
                          }
                        }
                        e.target.value = ''
                      }}
                    >
                      <option value="">选择数据来源...</option>
                      {dataSourceOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}

                  <input
                    type="text"
                    value={newParamValue}
                    onChange={(e) => setNewParamValue(e.target.value)}
                    placeholder="值或引用"
                    className="mapping-expression-input"
                  />
                  <button
                    type="button"
                    className="btn-add-mapping-confirm"
                    onClick={handleAddMapping}
                    disabled={!newParamKey}
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {node.type === 'start' && (
          <>
            <div className="config-group">
              <label>开始节点</label>
              <p className="config-hint">流程起点，定义 Skill 的输入参数</p>
            </div>
            <div className="config-group">
              <label>Skill 输入参数（开发中）</label>
              <p className="config-hint">用于定义 Skill 接收的输入参数结构</p>
            </div>
          </>
        )}

        {node.type === 'end' && (
          <>
            <div className="config-group">
              <label>结束节点</label>
              <p className="config-hint">流程终点，定义 Skill 的输出结果</p>
            </div>
            <div className="config-group">
              <label>输出映射</label>
              <p className="config-hint">
                将前序节点的输出映射为 Skill 输出
              </p>

              <div className="output-mapping-simple">
                {Object.entries(outputMapping).map(([key, value]) => (
                  <div key={key} className="mapping-row">
                    <input
                      type="text"
                      value={key}
                      className="mapping-key"
                      disabled
                      placeholder="输出字段名"
                    />
                    <span className="mapping-arrow">=</span>
                    <input
                      type="text"
                      value={value}
                      className="mapping-value"
                      onChange={(e) => handleUpdateOutputMappingValue(key, e.target.value)}
                      placeholder="值或引用"
                    />
                    <button
                      type="button"
                      className="btn-remove-mapping"
                      onClick={() => handleRemoveOutputMapping(key)}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className="mapping-add-row">
                  <input
                    type="text"
                    value={newOutputKey}
                    onChange={(e) => setNewOutputKey(e.target.value)}
                    placeholder="输出字段名"
                    className="mapping-param-select"
                  />

                  {/* 数据源选择下拉框 */}
                  {dataSourceOptions.length > 0 && (
                    <select
                      className="mapping-source-select"
                      value=""
                      onChange={(e) => {
                        const source = dataSourceOptions.find(opt => opt.value === e.target.value)
                        if (source && source.type === 'node') {
                          // 获取工具的输出字段
                          const sourceNode = prevNodes.find(n => n.id === source.value)
                          const sourceTool = tools.find(t => t.name === sourceNode?.config.toolName)
                          // 尝试从 outputSchema 获取字段
                          const outputFields = sourceTool?.outputSchema?.properties
                            ? Object.keys(sourceTool.outputSchema.properties)
                            : []
                          if (outputFields.length > 0) {
                            insertExpression(setNewOutputValue, source.value, outputFields[0])
                          } else {
                            // 默认使用常见字段名
                            insertExpression(setNewOutputValue, source.value, 'message')
                          }
                        } else if (source && source.type === 'input') {
                          const fields = Object.keys(skillInputSchema?.properties || {})
                          if (fields.length > 0) {
                            insertExpression(setNewOutputValue, 'input', fields[0])
                          } else {
                            insertExpression(setNewOutputValue, 'input')
                          }
                        }
                        e.target.value = ''
                      }}
                    >
                      <option value="">选择数据来源...</option>
                      {dataSourceOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}

                  <input
                    type="text"
                    value={newOutputValue}
                    onChange={(e) => setNewOutputValue(e.target.value)}
                    placeholder="值或引用"
                    className="mapping-expression-input"
                  />
                  <button
                    type="button"
                    className="btn-add-mapping-confirm"
                    onClick={handleAddOutputMapping}
                    disabled={!newOutputKey}
                  >
                    添加
                  </button>
                </div>

                {/* 显示可用的数据源 */}
                {dataSourceOptions.length > 0 && (
                  <div className="available-sources">
                    <p className="config-hint" style={{ marginBottom: '8px' }}>
                      可选数据源：
                    </p>
                    {dataSourceOptions.map(opt => (
                      <div key={opt.value} className="source-tag">
                        <span className="source-label">{opt.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {node.type === 'tool' && (
        <div className="config-footer">
          <button className="btn-primary" onClick={handleSave}>保存配置</button>
        </div>
      )}
    </div>
  )
}
