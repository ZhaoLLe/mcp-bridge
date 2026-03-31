# Skill 三种暴露模式使用指南

本文档说明如何在 Claude Code 客户端中使用 MCP Bridge 创建的 Skill。

---

## 三种暴露模式对比

| 模式 | 触发方式 | 适用场景 | 配置方式 |
|------|----------|----------|----------|
| **asSkill** | Claude 自动识别 description | 希望 Claude 主动推荐使用 | 生成 SKILL.md 文件 |
| **asTool** | 用户/ Claude 调用 `skill_xxx` | 需要精确控制调用时机 | 注册为 MCP Tool |
| **asPrompt** | 用户选择后发送 | 需要 Claude 参与决策 | 生成 Prompt 模板 |

---

## 模式一：asSkill（Skill 模式）

### 工作原理
- 系统自动生成 `SKILL.md` 文件
- 文件包含 YAML frontmatter，其中有 `description` 字段
- Claude Code 读取 `description` 判断何时使用该 Skill

### SKILL.md 示例
```markdown
---
name: weekend_recommend
description: This skill should be used when the user asks to "推荐周末活动", "周末干什么", or discusses 周末活动规划.
version: 1.0.0
---

# 周末活动推荐

根据天气推荐周末活动。

## When This Skill Applies

用户想要获取周末活动建议时使用此 Skill。

## 执行步骤

1. **获取天气**
   调用 `weather_query` 工具

2. **条件判断**
   根据天气条件决定推荐方向

## 可用工具

| 工具名 | 说明 |
|--------|------|
| weather_query | 查询天气 |
```

### 使用方法

#### 方式 A：导出到 Claude Code Plugin 目录

1. 在 MCP Bridge 中创建 Skill，勾选 **asSkill** 模式
2. 点击"下载 SKILL.md"按钮
3. 将文件放置到 Claude Code plugin 目录：

```bash
# macOS/Linux
~/.claude/plugins/mcp-bridge-skills/{skill-name}/SKILL.md

# Windows
%USERPROFILE%\.claude\plugins\mcp-bridge-skills\{skill-name}\SKILL.md
```

4. 重启 Claude Code
5. 当用户对话匹配 description 中的触发短语时，Claude 会自动使用该 Skill

#### 方式 B：通过 MCP 服务动态注册（推荐）

1. 在 MCP Bridge 中创建 Skill，勾选 **asSkill** 模式
2. 确保 MCP Bridge 服务已启动
3. 在 Claude Code 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "mcp-bridge": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

4. Claude Code 启动时会自动发现可用的 Skills

### 触发示例

用户输入：
- "推荐周末活动"
- "周末干什么"
- "根据天气推荐"

Claude 会自动识别并调用该 Skill。

---

## 模式二：asTool（Tool 模式）

### 工作原理
- Skill 被注册为一个 MCP Tool，名称为 `skill_{skillName}`
- 可以通过 MCP 协议直接调用
- 服务端执行 Skill 定义的流程

### 在 Claude Code 中使用

#### 方式 1：通过 MCP Bridge 服务

1. 确保 MCP Bridge 服务已启动
2. 在 Claude Code 中配置 MCP：

```json
{
  "mcpServers": {
    "mcp-bridge": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

3. Claude Code 会自动发现可用的 tools，包括 `skill_xxx`
4. 调用方式：

```
/工具 skill_weekend_recommend 帮我推荐周末活动
```

或直接让 Claude 调用：
```
请帮我推荐周末活动
```

Claude 会看到可用的 tool `skill_weekend_recommend` 并决定是否调用。

#### 方式 2：通过 API 直接调用

```bash
# 调用 Skill
curl -X POST http://localhost:3000/api/skills/{skillName}/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "city": "北京"
  }'
```

### 查看可用的 Skills

```bash
# 列出所有 Skills（包括 asTool 模式的）
curl http://localhost:3000/api/skills

# 列出所有 Tools（包括 skill_xxx）
curl http://localhost:3000/api/tools
```

---

## 模式三：asPrompt（Prompt 模式）

### 工作原理
- 生成一个 Prompt 模板（纯文本）
- 用户手动选择并发送给 Claude
- Claude 根据 Prompt 指导执行任务

### Prompt 模板示例

```
# 周末活动推荐

根据天气推荐周末活动。

## 执行步骤

1. 调用 `weather_query` 工具获取天气
2. 根据天气条件决定推荐方向
3. 返回活动推荐

## 参数

- city: 城市名称
```

### 使用方法

1. 在 MCP Bridge 中创建 Skill，勾选 **asPrompt** 模式
2. 点击"下载 Prompt 模板"按钮
3. 将 Prompt 模板保存为文本文件
4. 在需要时，复制 Prompt 内容发送给 Claude
5. Claude 会按照 Prompt 中的步骤执行

---

## 推荐配置策略

### 场景 1：自动化任务
**配置**: asSkill + asTool

用户可以说"推荐周末活动"，Claude 自动调用；也可以明确调用 `skill_weekend_recommend`。

### 场景 2：需要人工确认的任务
**配置**: asPrompt

用户查看 Prompt 模板，决定何时使用，复制给 Claude 执行。

### 场景 3：通用 Skill
**配置**: asSkill + asTool + asPrompt（全选）

三种方式都可用，用户根据场景选择。

---

## 完整示例：天气推荐 Skill

### 1. 创建 Skill

在 MCP Bridge 中创建 Skill：
- **name**: `weather_recommend`
- **displayName**: 天气活动推荐
- **description**: 根据天气情况推荐合适的活动
- **triggerPhrases**: ["推荐活动", "天气怎么样", "去哪里玩"]
- **exposeModes**:
  - asSkill: ✓
  - asTool: ✓
  - asPrompt: ✓
- **流程编排**:
  - Start → weather_query → condition → (outdoor_activity / indoor_activity) → End

### 2. asSkill 模式使用

用户输入："推荐个活动吧"

Claude 识别到 description 中的关键词，自动调用 Skill。

### 3. asTool 模式使用

用户输入：
```
请调用 skill_weather_recommend 帮我推荐活动
```

或直接：
```
帮我推荐活动
```

Claude 选择调用 `skill_weather_recommend` tool。

### 4. asPrompt 模式使用

1. 下载 Prompt 模板
2. 复制内容发送给 Claude：

```
# 天气活动推荐

根据天气情况推荐合适的活动。

## 执行步骤

1. 调用 `weather_query` 工具获取当前天气
2. 如果天气晴朗，推荐户外活动
3. 如果下雨，推荐室内活动
```

---

## 常见问题

### Q: 为什么我的 Skill 没有被 Claude 发现？

A: 检查以下几点：
1. 确认 Skill 状态为 **enabled**
2. 确认勾选了对应的暴露模式
3. 确认 MCP Bridge 服务正在运行
4. 确认 Claude Code 的 MCP 配置正确

### Q: 如何调试 Skill 执行？

A:
1. 访问 `http://localhost:3000/logs` 查看调用日志
2. 在日志中可以看到每次执行的输入、输出和错误信息

### Q: 可以修改已导出的 SKILL.md 吗？

A: 可以，但建议：
1. 在 MCP Bridge 中修改 Skill 配置
2. 重新导出 SKILL.md 覆盖原文件
3. 直接修改文件可能导致与 MCP Bridge 中的配置不一致

---

## 快速开始

1. **启动 MCP Bridge 服务**
   ```bash
   npm run dev
   ```

2. **访问管理界面**
   ```
   http://localhost:3000
   ```

3. **创建第一个 Skill**
   - 点击"创建 Skill"
   - 填写基本信息
   - 添加工具节点
   - 配置输入映射
   - 勾选 asSkill + asTool
   - 保存

4. **在 Claude Code 中使用**
   - 配置 MCP 连接到 `http://localhost:3000/sse`
   - 重启 Claude Code
   - 使用触发短语或调用 `skill_xxx`
