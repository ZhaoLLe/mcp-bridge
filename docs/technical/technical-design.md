# MCP Bridge 管理平台技术方案

> **版本**：1.0.0
> **日期**：2026-03-27
> **关联需求**：management-platform.md v3.0.0

---

## 目录

1. [系统架构](#一系统架构)
2. [后端设计](#二后端设计)
3. [前端设计](#三前端设计)
4. [API 规范](#四api-规范)
5. [核心流程](#五核心流程)
6. [数据存储](#六数据存储)
7. [关键技术点](#七关键技术点)

---

## 一、系统架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              前端 (React + Vite)                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  ToolsPage  │  │ SkillsPage  │  │ SkillEditor │  │     LogsPage        │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP / WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              后端 (Hono + Node.js)                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           API Layer                                  │   │
│  │  tools.ts  │  skills.ts  │  logs.ts  │  export.ts                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          Core Layer                                  │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ ToolRegistry │  │SkillRegistry │  │     SkillExecutor        │  │   │
│  │  │              │  │              │  │  (执行 Skill 流程)        │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  │         │                 │                        │               │   │
│  │         │                 │                        │               │   │
│  │         ▼                 ▼                        ▼               │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │                    SkillMdGenerator                          │  │   │
│  │  │                 (生成 SKILL.md 内容)                          │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Transport Layer                               │   │
│  │  SSE Server  │  WebSocket Server  │  WSClientManager                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MCP 客户端 (工具执行端)                            │
│                                                                             │
│  WebSocket 连接，接收工具调用请求，返回执行结果                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 模块职责

| 模块 | 职责 |
|------|------|
| **ToolRegistry** | 管理工具的注册、查询、状态控制 |
| **SkillRegistry** | 管理 Skill 的 CRUD、状态控制、引用关系 |
| **SkillExecutor** | 执行 Skill 流程，遍历节点、调用工具、条件判断 |
| **SkillMdGenerator** | 根据 Skill 配置生成 SKILL.md 内容 |
| **InvokeLogStore** | 存储调用日志（内存） |

### 1.3 技术栈确认

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 18.x |
| UI 组件 | Ant Design | 5.x |
| 流程编排 | React Flow | 11.x |
| 状态管理 | Zustand | 4.x |
| 构建工具 | Vite | 5.x |
| 后端框架 | Hono | 4.x |
| 运行时 | Node.js | 20.x |
| 类型检查 | TypeScript | 5.x |

---

## 二、后端设计

### 2.1 SkillRegistry（Skill 注册中心）

**职责**：
- Skill 的 CRUD 操作
- 状态管理（启用/禁用）
- 触发短语、暴露模式配置
- 工具引用关系查询

**核心接口**：

```typescript
class SkillRegistry {
  private skills: Map<string, Skill> = new Map()

  // CRUD
  register(request: CreateSkillRequest): Skill
  get(name: string): Skill | undefined
  getById(id: string): Skill | undefined
  getAll(): Skill[]
  list(options: ListOptions): SkillListResponse
  update(name: string, request: UpdateSkillRequest): Skill
  delete(name: string): boolean

  // 状态控制
  toggleStatus(name: string): Skill

  // 配置更新
  updateTriggerPhrases(name: string, phrases: string[]): Skill
  updateExposeModes(name: string, modes: Partial<ExposeModes>): Skill

  // 引用查询
  getSkillsUsingTool(toolName: string): Skill[]
  getReferencedTools(): Set<string>
}
```

**验证规则**：
- name: snake_case 格式，唯一
- 必须有且仅有一个 start 和 end 节点
- tool 节点必须有 toolName
- condition 节点必须有 condition 表达式
- edges 的 source/target 必须指向存在的节点

### 2.2 SkillExecutor（Skill 执行引擎）

**职责**：
- 执行 Skill 流程
- 遍历节点图
- 调用工具（通过 ToolExecutor）
- 条件判断
- 记录执行过程

**执行流程**：

```
┌─────────────────────────────────────────────────────────────────┐
│                     Skill 执行流程                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 获取 Skill 定义                                             │
│  2. 验证 Skill 状态 (enabled)                                   │
│  3. 构建边映射 (edgeMap)                                        │
│  4. 找到 start 节点                                             │
│  5. 从 start 的下一个节点开始遍历                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  循环执行节点 (最多 maxSteps 次)                         │   │
│  │                                                         │   │
│  │  Tool 节点:                                             │   │
│  │    - 解析 inputMapping                                  │   │
│  │    - 调用 ToolExecutor.execute()                        │   │
│  │    - 存储输出到 nodeOutputs                             │   │
│  │                                                         │   │
│  │  Condition 节点:                                        │   │
│  │    - 解析 condition 表达式                              │   │
│  │    - 计算结果 (true/false)                              │   │
│  │    - 根据 edge.label 选择下一个节点                     │   │
│  │                                                         │   │
│  │  End 节点:                                              │   │
│  │    - 解析 outputMapping                                 │   │
│  │    - 返回最终结果                                       │   │
│  │    - 结束执行                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  6. 返回执行结果                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**核心接口**：

```typescript
class SkillExecutor {
  constructor(
    private skillRegistry: SkillRegistry,
    private toolExecutor: ToolExecutor,
    private config?: SkillExecutorConfig
  )

  async execute(skillName: string, input: Record<string, unknown>): Promise<SkillExecutionResult>
}
```

**表达式解析**：

| 表达式类型 | 示例 | 解析方式 |
|-----------|------|----------|
| 输入参数引用 | `${input.city}` | 从 input 中获取 |
| 节点输出引用 | `${get_weather.temperature}` | 从 nodeOutputs 中获取 |
| 字符串固定值 | `"北京"` | 直接返回字符串 |
| 数字 | `123` | Number() 转换 |
| 布尔值 | `true` / `false` | 直接返回 |

**条件操作符**：

| 操作符 | 示例 | 实现 |
|--------|------|------|
| `==` | `${a} == "value"` | 严格相等 |
| `!=` | `${a} != "value"` | 严格不等 |
| `>` | `${a} > 10` | 数值比较 |
| `<` | `${a} < 10` | 数值比较 |
| `>=` | `${a} >= 10` | 数值比较 |
| `<=` | `${a} <= 10` | 数值比较 |
| `contains` | `${a} contains "text"` | 字符串包含 |

### 2.3 SkillMdGenerator（SKILL.md 生成器）

**职责**：
- 根据 Skill 配置生成标准 SKILL.md 格式
- 生成 Prompt 模板

**生成模板**：

```markdown
---
name: {skill.name}
description: {自动生成}
version: 1.0.0
---

# {skill.displayName}

{skill.description}

## When This Skill Applies

用户想要{功能描述}时使用此 Skill。

## 执行步骤

{根据 nodes 生成}

## 可用工具

{根据 Tool 节点生成表格}

## 输入参数

{根据 inputSchema 生成}

## 示例

{自动生成示例}
```

**description 生成规则**：

```typescript
generateDescription(skill: Skill): string {
  const phrases = skill.triggerPhrases.map(p => `"${p}"`).join(', ')
  return `This skill should be used when the user asks to ${phrases}, or discusses ${skill.displayName}.`
}
```

### 2.4 Skill 注册为 MCP Tool

当 Skill 的 `exposeModes.asTool = true` 时，动态注册到 ToolRegistry：

```typescript
// 伪代码
function registerSkillAsTool(skill: Skill, registry: ToolRegistry) {
  registry.register({
    name: `skill_${skill.name}`,
    description: skill.description,
    inputSchema: skill.inputSchema,
    handler: {
      type: 'skill',
      skillName: skill.name
    }
  })
}
```

**ToolExecutor 扩展**：

```typescript
// 在 ToolExecutor.execute 中增加对 skill 类型 handler 的处理
async execute(toolName: string, args: Record<string, unknown>) {
  const tool = this.registry.get(toolName)

  if (tool.handler.type === 'skill') {
    // 转发到 SkillExecutor
    return this.skillExecutor.execute(tool.handler.skillName, args)
  }

  // 原有 websocket 逻辑
  // ...
}
```

### 2.5 InvokeLogStore（调用日志存储）

**职责**：
- 记录 Tool 和 Skill 的调用日志
- 支持查询和筛选

**接口**：

```typescript
class InvokeLogStore {
  private logs: InvokeLog[] = []
  private maxSize: number = 1000

  add(log: InvokeLog): void
  list(options: LogQueryOptions): LogListResponse
  get(id: string): InvokeLog | undefined
  clear(): void
}

interface LogQueryOptions {
  type?: 'tool' | 'skill'
  name?: string
  status?: 'success' | 'failed' | 'timeout'
  startTime?: number
  endTime?: number
  page?: number
  pageSize?: number
}
```

---

## 三、前端设计

### 3.1 页面结构

```
web/
├── src/
│   ├── App.tsx                    # 路由配置
│   ├── main.tsx                   # 入口
│   │
│   ├── pages/
│   │   ├── ToolsPage.tsx          # MCP 工具管理
│   │   ├── SkillsPage.tsx         # Skill 列表
│   │   ├── SkillEditorPage.tsx    # Skill 编排编辑器
│   │   └── LogsPage.tsx           # 调用日志
│   │
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Sidebar.tsx        # 侧边导航
│   │   │   └── Header.tsx
│   │   │
│   │   ├── Tools/
│   │   │   ├── ToolList.tsx       # 工具列表
│   │   │   ├── ToolForm.tsx       # 工具表单
│   │   │   └── ToolDetail.tsx     # 工具详情
│   │   │
│   │   ├── Skills/
│   │   │   ├── SkillList.tsx      # Skill 列表
│   │   │   ├── TriggerPhrasesInput.tsx  # 触发短语输入
│   │   │   ├── ExposeModesSelect.tsx    # 暴露模式选择
│   │   │   └── SkillMdPreview.tsx       # SKILL.md 预览
│   │   │
│   │   ├── Editor/
│   │   │   ├── FlowCanvas.tsx           # 画布
│   │   │   ├── NodePanel.tsx            # 节点面板
│   │   │   ├── StartNode.tsx            # 开始节点
│   │   │   ├── EndNode.tsx              # 结束节点
│   │   │   ├── ToolNode.tsx             # 工具节点
│   │   │   ├── ConditionNode.tsx        # 条件节点
│   │   │   ├── NodeConfigPanel.tsx      # 节点配置面板
│   │   │   └── ExpressionInput.tsx      # 表达式输入
│   │   │
│   │   └── Logs/
│   │       ├── LogList.tsx              # 日志列表
│   │       └── LogDetail.tsx            # 日志详情
│   │
│   ├── stores/
│   │   ├── toolsStore.ts          # 工具状态
│   │   ├── skillsStore.ts         # Skill 状态
│   │   ├── editorStore.ts         # 编辑器状态
│   │   └── logsStore.ts           # 日志状态
│   │
│   ├── services/
│   │   ├── api.ts                 # API 客户端
│   │   ├── toolsApi.ts            # 工具 API
│   │   ├── skillsApi.ts           # Skill API
│   │   └── logsApi.ts             # 日志 API
│   │
│   └── types/
│       └── index.ts               # 类型定义（与后端共享）
```

### 3.2 路由配置

```typescript
// App.tsx
const routes = [
  { path: '/', element: <Navigate to="/tools" /> },
  { path: '/tools', element: <ToolsPage /> },
  { path: '/tools/:name', element: <ToolDetailPage /> },
  { path: '/skills', element: <SkillsPage /> },
  { path: '/skills/new', element: <SkillEditorPage /> },
  { path: '/skills/:id/edit', element: <SkillEditorPage /> },
  { path: '/logs', element: <LogsPage /> },
]
```

### 3.3 SkillEditor 核心组件

#### 3.3.1 编辑器布局

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Header: 基本信息 + 操作按钮                                                │
├────────────────────────────────────────────────────────────────────────────┤
│         │                                                                  │
│  左侧   │                        中间画布                                  │
│  节点   │                                                                  │
│  面板   │   ┌───────┐        ┌──────────┐        ┌───────┐                │
│         │   │ 开始  │───────▶│天气查询  │───────▶│ 条件  │                │
│  ─────  │   └───────┘        └──────────┘        └───┬───┘                │
│         │                                            │                    │
│  可用   │                              ┌─────────────┴──┐                 │
│  工具   │                              ▼                ▼                 │
│         │                         ┌─────────┐      ┌──────┐               │
│  ─────  │                         │户外活动 │      │室内..│               │
│         │                         └────┬────┘      └───┬──┘               │
│         │                              │               │                  │
│         │                              └───────┬───────┘                  │
│         │                                      ▼                          │
│         │                                 ┌───────┐                        │
│         │                                 │ 结束  │                        │
│         │                                 └───────┘                        │
├────────────────────────────────────────────────────────────────────────────┤
│  Footer: 触发配置 + 暴露模式 + 导出按钮                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 3.3.2 editorStore（编辑器状态）

```typescript
interface EditorState {
  // 当前编辑的 Skill
  skill: Skill | null
  isDirty: boolean

  // 画布状态
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null

  // Actions
  setSkill: (skill: Skill) => void
  updateSkill: (updates: Partial<Skill>) => void
  addNode: (node: SkillNode) => void
  updateNode: (id: string, updates: Partial<SkillNode>) => void
  removeNode: (id: string) => void
  addEdge: (edge: SkillEdge) => void
  removeEdge: (id: string) => void
  selectNode: (id: string | null) => void

  // 保存/测试
  save: () => Promise<void>
  test: (input: Record<string, unknown>) => Promise<SkillExecutionResult>
}
```

#### 3.3.3 节点类型定义（React Flow）

```typescript
// 自定义节点类型
const nodeTypes = {
  start: StartNode,
  end: EndNode,
  tool: ToolNode,
  condition: ConditionNode,
}

// 节点数据结构
interface SkillNodeData {
  id: string
  type: SkillNodeType
  name: string
  config: SkillNodeConfig
  onConfigChange: (config: SkillNodeConfig) => void
  onDelete: () => void
}
```

#### 3.3.4 条件分支的边处理

Condition 节点通过 edge.label 区分 true/false 分支：

```typescript
// 添加条件分支边
const addConditionEdges = (conditionNodeId: string, trueTargetId: string, falseTargetId: string) => {
  addEdge({
    id: `${conditionNodeId}-${trueTargetId}`,
    source: conditionNodeId,
    target: trueTargetId,
    label: 'true',
    type: 'smoothstep',
    animated: true,
  })

  addEdge({
    id: `${conditionNodeId}-${falseTargetId}`,
    source: conditionNodeId,
    target: falseTargetId,
    label: 'false',
    type: 'smoothstep',
  })
}
```

### 3.4 导出功能（前端下载）

**实现方式**：前端打包下载 ZIP 文件

```typescript
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

async function exportSkills(skillIds: string[]) {
  const zip = new JSZip()

  // 创建 plugin 结构
  const pluginDir = zip.folder('.claude-plugin')
  pluginDir?.file('plugin.json', JSON.stringify({
    name: 'mcp-bridge-skills',
    description: 'Skills created via MCP Bridge',
    version: '1.0.0',
  }))

  // 获取每个 Skill 的 SKILL.md
  for (const skillId of skillIds) {
    const skillMd = await skillsApi.getSkillMd(skillId)
    const skill = await skillsApi.get(skillId)
    zip.file(`${skill.name}/SKILL.md`, skillMd)
  }

  // 生成 ZIP 并下载
  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, 'mcp-bridge-skills.zip')
}
```

**用户操作流程**：
1. 选择要导出的 Skill
2. 点击"导出"按钮
3. 浏览器下载 `mcp-bridge-skills.zip`
4. 用户解压到 `~/.claude/plugins/mcp-bridge-skills/`

---

## 四、API 规范

### 4.1 工具接口

#### GET /api/tools

**Query 参数**：
- `page`: 页码，默认 1
- `pageSize`: 每页数量，默认 20
- `status`: 状态筛选 `enabled` | `disabled`
- `search`: 搜索关键词

**响应**：
```json
{
  "success": true,
  "data": {
    "tools": [...],
    "total": 10
  }
}
```

#### POST /api/tools

**请求体**：
```json
{
  "name": "weather_query",
  "description": "查询天气",
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "城市名称" }
    },
    "required": ["city"]
  },
  "handler": {
    "type": "websocket",
    "timeout": 30000
  }
}
```

#### GET /api/tools/:name/skill-refs

**响应**：
```json
{
  "success": true,
  "data": {
    "skills": [
      { "id": "weekend_recommend", "displayName": "周末活动推荐" }
    ]
  }
}
```

### 4.2 Skill 接口

#### POST /api/skills

**请求体**：
```json
{
  "name": "weekend_recommend",
  "displayName": "周末活动推荐",
  "description": "根据天气推荐周末活动",
  "triggerPhrases": ["推荐周末活动", "周末干什么"],
  "exposeModes": {
    "asSkill": true,
    "asTool": true,
    "asPrompt": false
  },
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": { "type": "string" }
    },
    "required": ["city"]
  },
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "name": "开始",
      "config": {},
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "get_weather",
      "type": "tool",
      "name": "获取天气",
      "config": {
        "toolName": "weather_query",
        "inputMapping": {
          "city": "${input.city}"
        }
      },
      "position": { "x": 300, "y": 100 }
    }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "get_weather" }
  ]
}
```

#### GET /api/skills/:id/skill-md

**响应**：
```json
{
  "success": true,
  "data": {
    "content": "---\nname: weekend_recommend\n..."
  }
}
```

#### POST /api/skills/:id/test

**请求体**：
```json
{
  "city": "北京"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "status": "success",
    "output": { "activity": "户外跑步" },
    "duration": 1200,
    "nodeExecutions": [...]
  }
}
```

### 4.3 日志接口

#### GET /api/logs

**Query 参数**：
- `type`: `tool` | `skill`
- `name`: 名称筛选
- `status`: `success` | `failed` | `timeout`
- `page`, `pageSize`

---

## 五、核心流程

### 5.1 Skill 执行流程

```
┌──────────────┐
│  API 请求    │
│ POST /invoke │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ 获取 Skill   │────▶│ 检查状态     │
└──────────────┘     └──────┬───────┘
                            │ enabled
                            ▼
                     ┌──────────────┐
                     │ 构建边映射   │
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ 找到 start   │
                     │ 存储输入     │
                     └──────┬───────┘
                            │
       ┌────────────────────┴────────────────────┐
       │                                         │
       ▼                                         │
┌──────────────┐                                 │
│ 获取下一节点 │◀────────────────────────────────┤
└──────┬───────┘                                 │
       │                                         │
       ▼                                         │
┌──────────────┐                                 │
│ 判断节点类型 │                                 │
└──────┬───────┘                                 │
       │                                         │
       ├─ tool ──▶ 调用工具 ──▶ 存储输出 ────────┤
       │                                         │
       ├─ condition ──▶ 计算条件 ──▶ 选择分支 ───┤
       │                                         │
       └─ end ──▶ 返回结果 ──▶ 结束              │
                                                 │
       ┌─────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│ 记录日志     │
│ 返回响应     │
└──────────────┘
```

### 5.2 工具删除/禁用流程

```
┌──────────────┐
│ 删除/禁用请求│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 查询 Skill   │
│ 引用关系     │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ 是否被引用？     │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
   是        否
    │         │
    ▼         ▼
┌───────┐  ┌───────┐
│返回错误│  │执行操作│
│列出引用│  │返回成功│
└───────┘  └───────┘
```

---

## 六、数据存储

### 6.1 内存存储结构

本期不实现持久化，所有数据存储在内存中：

```typescript
// 全局存储
const storage = {
  // 工具注册表
  tools: Map<string, Tool>

  // Skill 注册表
  skills: Map<string, Skill>

  // 调用日志（最多保留 1000 条）
  logs: InvokeLog[]

  // 待处理的工具请求
  pendingRequests: Map<string, PendingRequest>
}
```

### 6.2 数据生命周期

| 数据 | 生命周期 | 限制 |
|------|----------|------|
| Tool | 服务运行期间 | 最多 100 个 |
| Skill | 服务运行期间 | 最多 100 个 |
| InvokeLog | 服务运行期间 | 最多 1000 条，FIFO 淘汰 |
| PendingRequest | 请求超时后清除 | 默认 30 秒超时 |

---

## 七、关键技术点

### 7.1 React Flow 集成

**安装依赖**：
```bash
npm install reactflow @reactflow/core @reactflow/controls @reactflow/minimap
```

**自定义节点示例**：

```typescript
// ToolNode.tsx
import { Handle, Position, NodeProps } from 'reactflow'

export function ToolNode({ data }: NodeProps<SkillNodeData>) {
  return (
    <div className="tool-node">
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <span className="icon">🔧</span>
        <span>{data.name}</span>
      </div>
      <div className="node-body">
        <div>工具: {data.config.toolName}</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
```

### 7.2 表达式解析器

```typescript
class ExpressionParser {
  parse(expression: string, context: ExecutionContext): unknown {
    // 字符串字面量
    if (expression.startsWith('"') && expression.endsWith('"')) {
      return expression.slice(1, -1)
    }

    // 变量引用
    if (expression.startsWith('${') && expression.endsWith('}')) {
      const path = expression.slice(2, -1)
      return this.resolvePath(path, context)
    }

    // 数字
    const num = Number(expression)
    if (!isNaN(num)) return num

    // 布尔
    if (expression === 'true') return true
    if (expression === 'false') return false

    return expression
  }

  private resolvePath(path: string, context: ExecutionContext): unknown {
    const parts = path.split('.')
    let value: unknown

    if (parts[0] === 'input') {
      value = context.input
      parts.shift()
    } else {
      value = context.nodeOutputs.get(parts[0])
      parts.shift()
    }

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }

    return value
  }
}
```

### 7.3 条件表达式求值

```typescript
class ConditionEvaluator {
  evaluate(condition: string, context: ExecutionContext): boolean {
    const operators = ['==', '!=', '>=', '<=', '>', '<', 'contains']

    for (const op of operators) {
      if (condition.includes(op)) {
        const [left, right] = condition.split(op).map(s => s.trim())
        const leftVal = this.parser.parse(left, context)
        const rightVal = this.parser.parse(right, context)

        return this.compare(leftVal, rightVal, op)
      }
    }

    // 无操作符，作为布尔值
    return Boolean(this.parser.parse(condition, context))
  }

  private compare(left: unknown, right: unknown, op: string): boolean {
    switch (op) {
      case '==': return left === right
      case '!=': return left !== right
      case '>': return Number(left) > Number(right)
      case '<': return Number(left) < Number(right)
      case '>=': return Number(left) >= Number(right)
      case '<=': return Number(left) <= Number(right)
      case 'contains': return String(left).includes(String(right))
      default: return false
    }
  }
}
```

### 7.4 Skill 转 Tool 动态注册

```typescript
// 在 SkillRegistry 状态变更时同步 ToolRegistry
class SkillRegistry {
  private syncToToolRegistry(skill: Skill, toolRegistry: ToolRegistry) {
    const toolName = `skill_${skill.name}`

    // 移除旧注册
    if (toolRegistry.has(toolName)) {
      toolRegistry.delete(toolName)
    }

    // 如果启用且 asTool=true，注册新工具
    if (skill.status === 'enabled' && skill.exposeModes.asTool) {
      toolRegistry.register({
        name: toolName,
        description: `[Skill] ${skill.description}`,
        inputSchema: skill.inputSchema,
        handler: {
          type: 'skill',
          skillName: skill.name
        }
      })
    }
  }
}
```

---

## 附录

### A. 文件清单

| 文件 | 说明 |
|------|------|
| `src/core/types.ts` | 类型定义扩展 |
| `src/core/skillRegistry.ts` | Skill 注册中心 |
| `src/core/skillExecutor.ts` | Skill 执行引擎 |
| `src/core/skillMdGenerator.ts` | SKILL.md 生成器 |
| `src/core/invokeLogStore.ts` | 调用日志存储 |
| `src/api/skills.ts` | Skill API 路由 |
| `src/api/logs.ts` | 日志 API 路由 |
| `web/src/pages/*` | 前端页面 |
| `web/src/components/*` | 前端组件 |
| `web/src/stores/*` | 状态管理 |

### B. 依赖清单

**后端新增**：
- 无（使用现有依赖）

**前端新增**：
- `reactflow` - 流程编排
- `zustand` - 状态管理
- `jszip` - ZIP 打包
- `file-saver` - 文件下载
- `@ant-design/icons` - 图标库