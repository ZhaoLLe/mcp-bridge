# MCP Bridge 管理平台需求文档

> **版本**：3.0.0
> **日期**：2026-03-27
> **状态**：已确认

---

## 目录

1. [项目概述](#一项目概述)
2. [核心概念](#二核心概念)
3. [功能需求](#三功能需求)
4. [接口设计](#四接口设计)
5. [数据模型](#五数据模型)
6. [技术方案](#六技术方案)
7. [实现计划](#七实现计划)
8. [附录](#八附录)

---

## 一、项目概述

### 1.1 背景

MCP Bridge 已实现 MCP 工具的动态注册与执行。本项目旨在增加**工具编排能力**，让用户能够将多个工具组合成可复用的 Skill（技能）。

### 1.2 核心目标

| 目标 | 说明 |
|------|------|
| 可视化编排 | 用户无需编写代码，拖拽创建 Skill |
| 自动生成 SKILL.md | 根据编排配置自动生成 Claude Code Skill 格式 |
| 多模式暴露 | Skill 可作为 MCP Tool、Claude Code Skill、Prompt 模板三种模式暴露 |
| 一键导出 | 导出到 Claude Code plugin 目录，Claude 自动识别 |

### 1.3 用户角色

| 角色 | 主要操作 |
|------|----------|
| 开发者 | 注册工具、编排 Skill、配置触发条件 |
| Claude 用户 | 通过 Skill 获得能力组合（自动触发或手动调用） |

### 1.4 本期范围

| 功能 | 状态 |
|------|------|
| 工具管理（增删改查、禁用/启用） | ✅ 包含 |
| Skill 编排编辑器 | ✅ 包含 |
| SKILL.md 自动生成 | ✅ 包含 |
| 触发短语配置 | ✅ 包含 |
| 多模式暴露（Tool + Skill + Prompt） | ✅ 包含 |
| 导出到 Claude Code plugin | ✅ 包含 |
| Skill 执行引擎 | ✅ 包含 |
| 调用日志 | ✅ 包含 |
| 数据持久化 | ❌ 不包含（内存存储） |
| 用户认证 | ❌ 不包含 |

---

## 二、核心概念

### 2.1 Claude Code Skill 机制

**Claude Code Skill 是一个 Markdown 文件**：

```markdown
---
name: weekend_recommend
description: This skill should be used when the user asks to "推荐周末活动", "周末干什么", or discusses 周末活动规划.
version: 1.0.0
---

# 周末活动推荐

[指导 Claude 如何执行任务的详细内容...]
```

**触发机制**：Claude 根据 `description` 字段自动判断是否使用此 Skill。

**文件位置**：
```
~/.claude/plugins/marketplaces/claude-plugins-official/plugins/
└── my-plugin/
    └── skills/
        └── skill-name/
            └── SKILL.md
```

### 2.2 我们的 Skill 定位

**我们的 Skill = 用户编排 + 自动生成 SKILL.md**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MCP Bridge Skill 体系                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   用户操作                                                               │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  可视化编排                                                       │  │
│   │  [开始] → [工具A] → [条件判断] → [工具B] → [结束]                 │  │
│   │                                                                   │  │
│   │  配置触发短语: "推荐周末活动", "周末干什么", "天气推荐"           │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│   自动生成                                                               │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                                                                   │  │
│   │   1. SKILL.md ──────────────▶ Claude Code Skill                 │  │
│   │   2. MCP Tool (skill_xxx) ──▶ Claude 直接调用                   │  │
│   │   3. Prompt 模板 ──────────▶ 用户选择后发送给 Claude            │  │
│   │                                                                   │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 三种暴露模式对比

| 模式 | 触发方式 | 适用场景 | 优势 |
|------|----------|----------|------|
| **Skill 模式** | Claude 自动判断 | 希望 Claude 主动推荐使用 | 无需用户显式调用 |
| **Tool 模式** | Claude 调用 skill_xxx | 需要精确控制调用时机 | 服务端控制执行流程 |
| **Prompt 模式** | 用户选择后发送 | 需要 Claude 参与决策 | Claude 可灵活调整 |

### 2.4 实体关系

```
┌─────────────┐         ┌─────────────┐
│    Tool     │◀────────│    Skill    │
│  (原子工具)  │  引用    │  (编排组合)  │
└─────────────┘         └─────────────┘
       │                       │
       │                       │ 生成
       │                       ▼
       │               ┌─────────────┐
       │               │  SKILL.md   │
       │               │  (Markdown) │
       │               └─────────────┘
       │                       │
       │                       ▼
       │               ┌─────────────┐
       └──────────────▶│ InvokeLog   │
                       │ (调用日志)  │
                       └─────────────┘
```

---

## 三、功能需求

### 3.1 工具管理

#### 3.1.1 功能清单

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 工具列表 | 分页展示所有工具，支持搜索筛选 | P0 |
| 创建工具 | 表单填写名称、描述、参数、Handler | P0 |
| 编辑工具 | 修改工具配置 | P0 |
| 删除工具 | 删除工具（检查 Skill 引用） | P0 |
| 启用/禁用 | 切换工具状态（检查 Skill 引用） | P0 |
| 测试调用 | 直接调用工具验证 | P1 |
| 查看引用 | 查看哪些 Skill 引用了该工具 | P1 |

#### 3.1.2 引用约束

**规则**：被 Skill 引用的工具禁止删除或禁用

**错误提示示例**：
```
无法删除工具 "weather_query"

该工具被以下 Skill 引用：
• 周末活动推荐 (weekend_recommend)
• 天气分析报告 (weather_report)

请先移除相关 Skill 中的引用，或删除这些 Skill。
```

---

### 3.2 Skill 编排（核心）

#### 3.2.1 功能清单

| 功能 | 描述 | 优先级 |
|------|------|--------|
| Skill 列表 | 分页展示所有 Skill | P0 |
| 创建 Skill | 进入编排编辑器创建 | P0 |
| 编辑 Skill | 修改 Skill 流程和配置 | P0 |
| 删除 Skill | 删除 Skill | P0 |
| 启用/禁用 | 控制是否暴露 | P0 |
| 触发短语配置 | 配置 Claude 自动触发的关键词 | P0 |
| 暴露模式配置 | 选择 Skill/Tool/Prompt 模式 | P0 |
| 测试执行 | 在编辑器中模拟执行 | P0 |
| 导出 SKILL.md | 下载生成的 Markdown 文件 | P0 |
| 导出到 Claude Code | 一键导出到 plugin 目录 | P0 |
| 复制 Skill | 基于现有 Skill 创建副本 | P2 |

#### 3.2.2 编排编辑器界面

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Skill 编辑器                                              [保存] [测试]   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  基本信息                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 名称    [weekend_recommend      ]  显示名 [周末活动推荐         ]  │   │
│  │ 描述    [根据天气推荐合适的周末活动  ]                              │   │
│  │ 状态    [● 启用  ○ 禁用]                                          │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  触发配置                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 触发短语（Claude 自动识别关键词）                                   │   │
│  │ [推荐周末活动] [周末干什么] [根据天气推荐] [+ 添加]                │   │
│  │                                                                    │   │
│  │ 暴露模式（可多选）                                                  │   │
│  │ [☑] Skill 模式    生成 SKILL.md，Claude 自动触发                   │   │
│  │ [☑] Tool 模式     注册为 skill_xxx，Claude 可直接调用              │   │
│  │ [☐] Prompt 模式   生成 Prompt 模板，用户选择后发送                 │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌──────────────┐  ┌───────────────────────────────────────────────────┐  │
│  │   节点面板   │  │                     画布                          │  │
│  │              │  │                                                   │  │
│  │ ▶ 开始       │  │   ┌───────┐        ┌──────────┐        ┌───────┐ │  │
│  │ ■ 结束       │  │   │ 开始  │───────▶│天气查询  │───────▶│ 条件  │ │  │
│  │ 🔧 工具      │  │   └───────┘        └──────────┘        └───┬───┘ │  │
│  │ ◆ 条件       │  │                                            │     │  │
│  │              │  │                              ┌─────────────┴──┐  │  │
│  │ ──────────   │  │                              ▼                ▼  │  │
│  │  可用工具    │  │                         ┌─────────┐      ┌──────┐│  │
│  │              │  │                         │户外活动 │      │室内..││  │
│  │ weather_     │  │                         └────┬────┘      └───┬──┘│  │
│  │ query        │  │                              │               │   │  │
│  │              │  │                              └───────┬───────┘   │  │
│  │ outdoor_     │  │                                      ▼           │  │
│  │ activity     │  │                                 ┌───────┐        │  │
│  │              │  │                                 │ 结束  │        │  │
│  └──────────────┘  │                                 └───────┘        │  │
│                    └───────────────────────────────────────────────────┘  │
│                                                                            │
│  [导出 SKILL.md]  [导出到 Claude Code]                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.3 节点类型

| 类型 | 图标 | 说明 | 配置项 |
|------|------|------|--------|
| **Start** | ▶ | 开始节点 | inputSchema |
| **End** | ■ | 结束节点 | outputMapping |
| **Tool** | 🔧 | 调用工具 | toolName, inputMapping |
| **Condition** | ◆ | 条件分支 | condition, true/false 路径 |

#### 3.2.4 参数表达式

| 表达式 | 说明 | 示例 |
|--------|------|------|
| `${input.field}` | 引用 Skill 输入参数 | `${input.city}` |
| `${nodeId}` | 引用节点完整输出 | `${get_weather}` |
| `${nodeId.field}` | 引用节点输出的字段 | `${get_weather.temperature}` |
| `"固定值"` | 字符串固定值 | `"北京"` |

**条件表达式操作符**：

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `==` | 等于 | `${node.weather} == "晴"` |
| `!=` | 不等于 | `${node.code} != 0` |
| `>` / `<` | 大于/小于 | `${node.count} > 10` |
| `contains` | 包含 | `${node.message} contains "错误"` |

---

### 3.3 触发短语配置

#### 3.3.1 功能说明

触发短语用于生成 SKILL.md 的 `description` 字段，告诉 Claude 何时使用此 Skill。

#### 3.3.2 配置界面

```
┌─────────────────────────────────────────────────────────────┐
│  触发短语配置                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  触发短语列表                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 推荐周末活动                                    [×] │   │
│  │ 周末干什么                                      [×] │   │
│  │ 根据天气推荐                                    [×] │   │
│  │ 周末去哪玩                                      [×] │   │
│  │                                                     │   │
│  │ [输入短语...]                              [添加]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  生成的 description:                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ This skill should be used when the user asks to    │   │
│  │ "推荐周末活动", "周末干什么", "根据天气推荐",       │   │
│  │ "周末去哪玩", or discusses 周末活动规划.            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3.3.3 最佳实践

| 建议 | 说明 |
|------|------|
| 使用自然语言 | 用户实际会说的话 |
| 覆盖多种表达 | 同一意图的不同说法 |
| 包含关键词 | 领域相关词汇 |
| 中英文混合 | 支持多语言触发 |

---

### 3.4 SKILL.md 生成

#### 3.4.1 自动生成规则

根据 Skill 编排配置自动生成标准 SKILL.md：

**生成模板**：
```markdown
---
name: {skill.name}
description: {根据触发短语自动生成}
version: 1.0.0
---

# {skill.displayName}

{skill.description}

## When This Skill Applies

用户想要{skill功能描述}时使用此 Skill。

## 执行步骤

{根据 nodes 自动生成步骤说明}

## 可用工具

{根据 Tool 节点自动生成工具列表}

## 输入参数

{根据 inputSchema 自动生成}

## 示例

{自动生成示例}
```

#### 3.4.2 生成示例

**输入**（编排配置）：
```typescript
{
  name: "weekend_recommend",
  displayName: "周末活动推荐",
  description: "根据天气推荐周末活动",
  triggerPhrases: ["推荐周末活动", "周末干什么", "根据天气推荐"],
  nodes: [
    { id: "start", type: "start", config: { inputSchema: { city: "string" } } },
    { id: "get_weather", type: "tool", config: { toolName: "weather_query" } },
    { id: "check", type: "condition", config: { condition: '${get_weather.weather} == "晴"' } },
    { id: "end", type: "end" }
  ]
}
```

**输出**（SKILL.md）：
```markdown
---
name: weekend_recommend
description: This skill should be used when the user asks to "推荐周末活动", "周末干什么", "根据天气推荐", or discusses 周末活动规划.
version: 1.0.0
---

# 周末活动推荐

根据天气推荐周末活动。

## When This Skill Applies

用户想要获取周末活动建议时使用此 Skill。

## 执行步骤

1. **获取天气信息**
   调用 `weather_query` 工具，传入城市名称

2. **条件判断**
   根据天气条件决定推荐方向：
   - 天气为"晴" → 走 true 分支
   - 其他天气 → 走 false 分支

3. **返回结果**

## 可用工具

| 工具名 | 说明 |
|--------|------|
| weather_query | 查询天气信息 |
| outdoor_activity | 户外活动推荐 |
| indoor_activity | 室内活动推荐 |

## 输入参数

- **city** (必填): 城市名称

## 示例

用户: "北京周末有什么好玩的？"

执行流程:
1. weather_query({ city: "北京" })
2. 条件判断
3. 返回活动推荐
```

---

### 3.5 导出到 Claude Code

#### 3.5.1 功能说明

一键将 Skill 导出到 Claude Code plugin 目录，使其自动生效。

#### 3.5.2 导出流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│  点击导出    │────▶│ 生成 Plugin  │────▶│ 写入文件系统         │
└──────────────┘     └──────────────┘     └──────────────────────┘
                                                  │
                                                  ▼
                           ~/.claude/plugins/mcp-bridge-skills/
                           └── weekend_recommend/
                               ├── SKILL.md
                               └── .claude-plugin/
                                   └── plugin.json
```

#### 3.5.3 导出目录结构

```
~/.claude/plugins/
└── mcp-bridge-skills/
    ├── .claude-plugin/
    │   └── plugin.json          # Plugin 元数据
    │
    ├── weekend_recommend/
    │   └── SKILL.md             # Skill 定义
    │
    ├── weather_report/
    │   └── SKILL.md
    │
    └── ... (其他 Skill)
```

**plugin.json**：
```json
{
  "name": "mcp-bridge-skills",
  "description": "Skills created via MCP Bridge",
  "version": "1.0.0",
  "author": {
    "name": "MCP Bridge User"
  }
}
```

#### 3.5.4 导出界面

```
┌─────────────────────────────────────────────────────────────┐
│  导出到 Claude Code                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  选择要导出的 Skill:                                         │
│                                                             │
│  [☑] weekend_recommend    周末活动推荐                       │
│  [☑] weather_report       天气分析报告                       │
│  [☐] data_analysis        数据分析                          │
│                                                             │
│  导出位置:                                                   │
│  ~/.claude/plugins/mcp-bridge-skills/                       │
│                                                             │
│  [取消]                              [导出]                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.6 调用日志

#### 3.6.1 功能清单

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 日志列表 | 分页展示调用记录 | P0 |
| 筛选查询 | 按类型、名称、状态筛选 | P0 |
| 日志详情 | 查看完整参数和结果 | P0 |

#### 3.6.2 日志列表

```
┌────────────────────────────────────────────────────────────────────────────┐
│  调用日志                                                                  │
│                                                                            │
│  类型 [全部 ▼]  名称 [搜索...]  状态 [全部 ▼]              [刷新]         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  时间                │ 类型   │ 名称                │ 状态   │ 耗时  │ 操作 │
│  ───────────────────┼────────┼────────────────────┼────────┼───────┼──────│
│  2026-03-27 14:30:15│ Skill  │ weekend_recommend  │ 成功   │ 2.1s  │ 详情 │
│  2026-03-27 14:28:03│ Tool   │ weather_query      │ 失败   │ 30s   │ 详情 │
│  2026-03-27 14:25:45│ Tool   │ send_message       │ 成功   │ 0.8s  │ 详情 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 四、接口设计

### 4.1 工具接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tools` | 工具列表 |
| GET | `/api/tools/:name` | 工具详情 |
| POST | `/api/tools` | 创建工具 |
| PUT | `/api/tools/:name` | 更新工具 |
| DELETE | `/api/tools/:name` | 删除工具 |
| PATCH | `/api/tools/:name/status` | 切换状态 |
| GET | `/api/tools/:name/skill-refs` | 查看引用 |
| POST | `/api/tools/:name/invoke` | 测试调用 |

### 4.2 Skill 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/skills` | Skill 列表 |
| GET | `/api/skills/:id` | Skill 详情 |
| POST | `/api/skills` | 创建 Skill |
| PUT | `/api/skills/:id` | 更新 Skill |
| DELETE | `/api/skills/:id` | 删除 Skill |
| PATCH | `/api/skills/:id/status` | 切换状态 |
| PUT | `/api/skills/:id/trigger-phrases` | 更新触发短语 |
| PATCH | `/api/skills/:id/expose-modes` | 更新暴露模式 |
| POST | `/api/skills/:id/invoke` | 调用（Tool 模式） |
| POST | `/api/skills/:id/test` | 测试执行 |
| GET | `/api/skills/:id/skill-md` | 获取生成的 SKILL.md |
| GET | `/api/skills/:id/export` | 下载 SKILL.md 文件 |
| POST | `/api/skills/export` | 批量导出到 Claude Code |

### 4.3 导出接口

**请求示例**：
```http
POST /api/skills/export
Content-Type: application/json

{
  "skillIds": ["weekend_recommend", "weather_report"],
  "targetPath": "~/.claude/plugins/mcp-bridge-skills"
}
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "exportedCount": 2,
    "exportPath": "/Users/xxx/.claude/plugins/mcp-bridge-skills",
    "skills": [
      {
        "id": "weekend_recommend",
        "name": "周末活动推荐",
        "filePath": "/Users/xxx/.claude/plugins/mcp-bridge-skills/weekend_recommend/SKILL.md"
      },
      {
        "id": "weather_report",
        "name": "天气分析报告",
        "filePath": "/Users/xxx/.claude/plugins/mcp-bridge-skills/weather_report/SKILL.md"
      }
    ]
  }
}
```

---

## 五、数据模型

### 5.1 Skill

```typescript
interface Skill {
  id: string
  name: string                        // snake_case，唯一
  displayName: string                 // 显示名称
  description: string                 // 描述

  // 触发配置
  triggerPhrases: string[]            // 触发短语列表

  // 暴露模式
  exposeModes: {
    asSkill: boolean                  // 生成 SKILL.md
    asTool: boolean                   // 注册为 MCP Tool
    asPrompt: boolean                 // 生成 Prompt 模板
  }

  status: 'enabled' | 'disabled'
  inputSchema: InputSchema
  outputSchema?: InputSchema
  nodes: SkillNode[]
  edges: SkillEdge[]

  createdAt: number
  updatedAt: number
}

interface SkillNode {
  id: string
  type: 'start' | 'end' | 'tool' | 'condition'
  name: string
  config: {
    inputSchema?: InputSchema
    toolName?: string
    inputMapping?: Record<string, string>
    condition?: string
    trueTarget?: string
    falseTarget?: string
    outputMapping?: Record<string, string>
  }
  position: { x: number; y: number }
}

interface SkillEdge {
  id: string
  source: string
  target: string
  label?: string
}
```

### 5.2 Tool 扩展

```typescript
interface Tool {
  name: string
  description: string
  inputSchema: InputSchema
  handler: ToolHandler
  status: 'enabled' | 'disabled'
  createdAt: number
  updatedAt: number
}
```

### 5.3 InvokeLog

```typescript
interface InvokeLog {
  id: string
  type: 'tool' | 'skill'
  name: string
  skillId?: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: { code: string; message: string }
  status: 'success' | 'failed' | 'timeout'
  duration: number
  timestamp: number
  subCalls?: InvokeLog[]
}
```

---

## 六、技术方案

### 6.2 页面架构

**两个独立管理入口**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MCP Bridge 管理平台                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │  MCP 工具   │    │   Skill     │    │  调用日志   │                │
│  │   管理      │    │   管理      │    │             │                │
│  └─────────────┘    └─────────────┘    └─────────────┘                │
│         │                  │                  │                        │
│         ▼                  ▼                  ▼                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │ • 工具列表  │    │ • Skill列表 │    │ • 日志列表  │                │
│  │ • 创建工具  │    │ • 创建Skill │    │ • 筛选查询  │                │
│  │ • 编辑工具  │    │ • 编排编辑  │    │ • 详情查看  │                │
│  │ • 禁用/启用 │    │ • 触发配置  │                                 │
│  │ • 测试调用  │    │ • 导出Skill │                                 │
│  │ • 查看引用  │    │             │                                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**导航结构**：

| 菜单项 | 页面 | 说明 |
|--------|------|------|
| MCP 工具 | ToolsPage | 管理 MCP 工具的增删改查、状态控制 |
| Skill | SkillsPage + SkillEditor | Skill 列表 + 编排编辑器 |
| 调用日志 | LogsPage | Tool 和 Skill 的调用记录 |

### 6.3 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 5.x | 类型支持 |
| Vite | 5.x | 构建工具 |
| Ant Design | 5.x | UI 组件库 |
| React Flow | 11.x | 流程编排可视化 |
| Zustand | 4.x | 状态管理 |

### 6.4 后端扩展

```
src/
├── core/
│   ├── types.ts
│   ├── registry.ts
│   ├── skillRegistry.ts          # Skill 注册中心
│   ├── skillExecutor.ts          # Skill 执行引擎
│   └── skillMdGenerator.ts       # SKILL.md 生成器（新增）
│
├── api/
│   ├── tools.ts
│   ├── skills.ts                 # Skill CRUD + 导出
│   └── logs.ts
│
└── web/
    ├── pages/
    │   ├── ToolsPage.tsx
    │   ├── SkillsPage.tsx
    │   ├── SkillEditor.tsx       # 编排编辑器
    │   └── LogsPage.tsx
    └── components/
        ├── TriggerPhrasesInput.tsx   # 触发短语输入（新增）
        ├── ExposeModesSelect.tsx     # 暴露模式选择（新增）
        ├── SkillMdPreview.tsx        # SKILL.md 预览（新增）
        └── ExportModal.tsx           # 导出弹窗（新增）
```

### 6.5 SKILL.md 生成器

```typescript
class SkillMdGenerator {
  generate(skill: Skill): string {
    return `---
name: ${skill.name}
description: ${this.generateDescription(skill)}
version: 1.0.0
---

# ${skill.displayName}

${skill.description}

## When This Skill Applies

用户想要${this.getSkillPurpose(skill)}时使用此 Skill。

## 执行步骤

${this.generateSteps(skill)}

## 可用工具

${this.generateToolsTable(skill)}

## 输入参数

${this.generateInputParams(skill)}
`
  }

  generateDescription(skill: Skill): string {
    const phrases = skill.triggerPhrases.map(p => `"${p}"`).join(', ')
    return `This skill should be used when the user asks to ${phrases}, or discusses ${skill.displayName}.`
  }

  generateSteps(skill: Skill): string {
    const steps: string[] = []
    let stepNum = 1

    for (const node of skill.nodes) {
      if (node.type === 'tool') {
        steps.push(`${stepNum}. **${node.name}**\n   调用 \`${node.config.toolName}\` 工具`)
        stepNum++
      } else if (node.type === 'condition') {
        steps.push(`${stepNum}. **条件判断**\n   ${node.config.condition}`)
        stepNum++
      }
    }

    return steps.join('\n\n')
  }
}
```

---

## 七、实现计划

### 7.1 阶段划分

| 阶段 | 内容 | 工时 |
|------|------|------|
| **Phase 1** | Skill 数据模型 + 注册中心 + 执行引擎 | 2天 |
| **Phase 2** | SKILL.md 生成器 + 触发短语配置 | 1天 |
| **Phase 3** | 编排编辑器（React Flow） | 4天 |
| **Phase 4** | 工具管理 + Skill 管理页面 | 2天 |
| **Phase 5** | 导出功能 + 日志模块 | 2天 |
| **Phase 6** | 集成测试 + 优化 | 1天 |

**总计：12 天**

### 7.2 里程碑

| 里程碑 | 完成标准 |
|--------|----------|
| M1 | Skill 可通过 API 创建和执行 |
| M2 | SKILL.md 可自动生成 |
| M3 | 可视化编辑器可用 |
| M4 | 管理页面完整可用 |
| M5 | 可导出到 Claude Code |
| M6 | 功能完整，测试通过 |

---

## 八、附录

### 8.1 术语表

| 术语 | 说明 |
|------|------|
| Tool | MCP 工具，原子能力单元 |
| Skill | 工具编排组合，可生成 SKILL.md |
| SKILL.md | Claude Code Skill 定义文件 |
| 触发短语 | 用于 Claude 自动识别 Skill 的关键词 |
| 暴露模式 | Skill 对外暴露方式（Skill/Tool/Prompt） |
| Node | 流程节点 |
| Edge | 节点连接 |

### 8.2 Claude Code Skill 文件位置

```
~/.claude/plugins/marketplaces/claude-plugins-official/plugins/
└── {plugin-name}/
    └── skills/
        └── {skill-name}/
            └── SKILL.md
```

### 8.3 参考资料

- [MCP 协议规范](https://modelcontextprotocol.io/)
- [React Flow 文档](https://reactflow.dev/)
- [Ant Design 组件库](https://ant.design/)
- [Claude Code Plugin 开发](https://docs.anthropic.com/claude-code/plugins)