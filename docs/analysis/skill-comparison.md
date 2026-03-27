# Skill 概念对比与对接方案

> **版本**：2.0.0
> **日期**：2026-03-27

---

## 一、Claude Code Skill 机制揭秘

### 1.1 Skill 文件结构

**Skill 是一个 Markdown 文件**，位于插件目录中：

```
plugins/
└── my-plugin/
    └── skills/
        └── skill-name/
            ├── SKILL.md          # 必需：主定义文件
            ├── README.md         # 可选：额外文档
            ├── references/       # 可选：参考材料
            └── examples/         # 可选：示例文件
```

### 1.2 SKILL.md 格式

```markdown
---
name: skill-name
description: This skill should be used when the user asks to "specific phrase", "another phrase", or discusses topic-area.
version: 1.0.0
---

# Skill 标题

[指导 Claude 如何执行任务的详细内容]

## When This Skill Applies
[描述何时使用此 Skill]

## 执行步骤
[具体步骤指导]
```

### 1.3 关键字段

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | ✅ | Skill 标识符 |
| `description` | ✅ | **触发条件**：告诉 Claude 何时使用此 Skill |
| `version` | ❌ | 语义版本号 |

### 1.4 触发机制

**关键**：`description` 字段定义触发条件

```yaml
# 好的 description 示例
description: This skill should be used when the user asks to "推荐周末活动", "根据天气推荐", "周末干什么", or discusses 周末活动规划.
```

**Claude 会根据 description 自动判断是否使用此 Skill**。

---

## 二、Skill vs Command vs Agent

| 类型 | 触发方式 | 用途 |
|------|----------|------|
| **Command** | 用户显式调用 `/command_name` | 用户主动执行的操作 |
| **Skill** | Claude 自动判断使用 | 模型自主调用的能力 |
| **Agent** | Claude 派生子任务 | 复杂任务的并行处理 |

**我们的定位**：我们要创建的是 **Skill**，让 Claude 能自动识别和调用。

---

## 三、我们的 Skill 与官方 Skill 的关系

### 3.1 本质一致

| 维度 | 官方 Skill | 我们的 Skill |
|------|-----------|--------------|
| **本质** | Markdown 文件 + Prompt | Markdown 文件 + Prompt（自动生成） |
| **创建者** | Anthropic 开发者 | 用户可视化编排 |
| **触发方式** | description 字段 | description 字段 |
| **调用方式** | Claude 自动判断 | Claude 自动判断 |

### 3.2 我们的创新点

| 创新点 | 说明 |
|--------|------|
| **可视化编排** | 用户无需手写 Markdown，拖拽生成 |
| **自动生成 SKILL.md** | 根据编排自动生成标准格式 |
| **工具绑定** | 将 MCP 工具无缝集成到 Skill 中 |
| **双模式暴露** | 同时支持 Tool 模式和 Skill 模式 |

---

## 四、对接方案

### 4.1 架构设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MCP Bridge                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Skill 编排编辑器                            │   │
│  │  [开始] → [天气查询] → [条件判断] → [活动推荐] → [结束]          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Skill 生成器                                 │   │
│  │                                                                  │   │
│  │  输入: 编排配置 (nodes, edges)                                   │   │
│  │  输出:                                                           │   │
│  │    ├── SKILL.md (Claude Code Skill 格式)                        │   │
│  │    ├── MCP Tool (skill_xxx)                                     │   │
│  │    └── Prompt 模板 (提示词模式)                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│              ┌───────────────┼───────────────┐                         │
│              ▼               ▼               ▼                         │
│  ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐            │
│  │ Claude Code      │ │ MCP Tool     │ │ Prompt 模板      │            │
│  │ Plugin 目录      │ │ 注册         │ │ 供选择使用       │            │
│  │ ~/.claude/...    │ │              │ │                  │            │
│  └──────────────────┘ └──────────────┘ └──────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 生成的 SKILL.md 示例

**编排配置**：
```typescript
{
  name: "weekend_recommend",
  displayName: "周末活动推荐",
  description: "根据天气推荐周末活动",
  triggerPhrases: ["推荐周末活动", "周末干什么", "根据天气推荐"],
  nodes: [...],
  edges: [...]
}
```

**生成的 SKILL.md**：
```markdown
---
name: weekend_recommend
description: This skill should be used when the user asks to "推荐周末活动", "周末干什么", "根据天气推荐", "周末去哪玩", or discusses 周末活动规划.
version: 1.0.0
---

# 周末活动推荐

根据用户提供的城市天气，推荐合适的周末活动。

## When This Skill Applies

用户想要获取周末活动建议时使用此 Skill。

## 执行步骤

1. **获取天气信息**
   调用 `weather_query` 工具，传入城市名称
   - 参数: city (用户输入的城市)

2. **条件判断**
   根据天气条件决定推荐方向：
   - 天气为"晴" → 推荐户外活动
   - 其他天气 → 推荐室内活动

3. **返回推荐结果**
   根据判断结果，返回合适的活动建议

## 可用工具

| 工具名 | 说明 | 参数 |
|--------|------|------|
| weather_query | 查询天气 | city: string |
| outdoor_activity | 户外活动推荐 | temperature: number |
| indoor_activity | 室内活动推荐 | - |

## 输入参数

- **city** (必填): 城市名称

## 示例

用户: "北京周末有什么好玩的？"

执行:
1. weather_query({ city: "北京" }) → { weather: "晴", temperature: 25 }
2. 条件判断: 天气晴 → 户外活动
3. outdoor_activity({ temperature: 25 }) → { activity: "户外跑步、骑行" }

返回: "北京天气晴朗，温度25度，推荐户外跑步或骑行"
```

### 4.3 数据模型扩展

```typescript
interface Skill {
  id: string
  name: string
  displayName: string
  description: string

  // 新增：触发短语（用于生成 description）
  triggerPhrases: string[]

  // 暴露模式
  exposeMode: {
    asTool: boolean       // 注册为 MCP Tool
    asSkill: boolean      // 生成 SKILL.md
    asPrompt: boolean     // 生成 Prompt 模板
  }

  status: 'enabled' | 'disabled'
  inputSchema: InputSchema
  nodes: SkillNode[]
  edges: SkillEdge[]

  createdAt: number
  updatedAt: number
}
```

### 4.4 API 扩展

```
# 新增：导出 SKILL.md
GET  /api/skills/:id/skill-md     # 获取生成的 SKILL.md 内容
POST /api/skills/:id/export       # 导出为 plugin 包

# 新增：触发短语管理
PUT  /api/skills/:id/trigger-phrases   # 更新触发短语
```

---

## 五、实现路径

### 5.1 Phase 1: SKILL.md 生成器

**目标**：根据编排配置自动生成 SKILL.md

**实现**：
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
}
```

### 5.2 Phase 2: Plugin 目录集成

**目标**：将生成的 SKILL.md 放入 Claude Code plugin 目录

**实现**：
- 提供"导出到 Claude Code"按钮
- 自动生成 plugin 结构
- 写入 `~/.claude/plugins/mcp-bridge-skills/` 目录

### 5.3 Phase 3: 双向同步

**目标**：Skill 更新时自动同步 SKILL.md

---

## 六、总结

### 我们要做的

| 功能 | 说明 |
|------|------|
| **可视化编排** | 用户拖拽创建 Skill 流程 |
| **自动生成 SKILL.md** | 根据编排生成标准 Skill 文件 |
| **触发短语配置** | 用户定义何时触发此 Skill |
| **多模式暴露** | Tool + Skill + Prompt 三种模式 |
| **一键导出** | 导出到 Claude Code plugin 目录 |

### 核心价值

**让用户无需手写 Markdown，就能创建 Claude Code Skill！**

---

## 七、附录

### 7.1 官方 Skill 示例路径

```
~/.claude/plugins/marketplaces/claude-plugins-official/plugins/
├── mcp-server-dev/skills/build-mcp-server/SKILL.md
├── feature-dev/skills/.../SKILL.md
├── plugin-dev/skills/.../SKILL.md
└── ...
```

### 7.2 参考资料

- [Claude Code Plugin 开发文档](https://docs.anthropic.com/claude-code/plugins)
- [Skill 格式规范](https://docs.anthropic.com/claude-code/skills)