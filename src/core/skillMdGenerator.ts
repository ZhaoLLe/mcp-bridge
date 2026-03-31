/**
 * SKILL.md 生成器
 * 根据 Skill 编排配置自动生成 Claude Code Skill 格式的 Markdown 文件
 */

import type { Skill, SkillNode, InputSchema } from './types'

/**
 * SKILL.md 生成器配置
 */
export interface SkillMdGeneratorConfig {
  /** 版本号，默认 1.0.0 */
  version?: string
}

/**
 * SKILL.md 生成器
 */
export class SkillMdGenerator {
  private version: string

  constructor(config: SkillMdGeneratorConfig = {}) {
    this.version = config.version ?? '1.0.0'
  }

  /**
   * 生成 SKILL.md 内容
   */
  generate(skill: Skill): string {
    const sections: string[] = []

    // YAML Frontmatter
    sections.push(this.generateFrontmatter(skill))

    // 标题
    sections.push(`# ${skill.displayName}`)
    sections.push('')

    // 描述
    sections.push(skill.description)
    sections.push('')

    // When This Skill Applies
    sections.push('## When This Skill Applies')
    sections.push('')
    sections.push(`用户想要${this.getSkillPurpose(skill)}时使用此 Skill。`)
    sections.push('')

    // 触发短语
    if (skill.triggerPhrases && skill.triggerPhrases.length > 0) {
      sections.push('### 触发短语')
      sections.push('')
      sections.push('当用户输入以下内容时，会自动触发此 Skill：')
      sections.push('')
      for (const phrase of skill.triggerPhrases) {
        sections.push(`- "${phrase}"`)
      }
      sections.push('')
    }

    // 执行步骤
    sections.push('## 执行步骤')
    sections.push('')
    sections.push(this.generateSteps(skill))
    sections.push('')

    // 可用工具
    const tools = this.getUsedTools(skill)
    if (tools.length > 0) {
      sections.push('## 可用工具')
      sections.push('')
      sections.push(this.generateToolsTable(skill, tools))
      sections.push('')
    }

    // 输入参数 - 从 inputMapping 中提取
    sections.push('## 输入参数')
    sections.push('')
    sections.push(this.generateInputParamsFromMapping(skill))
    sections.push('')

    // 输出说明
    const endNode = skill.nodes.find(n => n.type === 'end')
    if (endNode?.config.outputMapping) {
      sections.push('## 输出')
      sections.push('')
      sections.push(this.generateOutputDescription(endNode))
      sections.push('')
    }

    // 示例
    sections.push('## 示例')
    sections.push('')
    sections.push(this.generateExample(skill))

    return sections.join('\n')
  }

  /**
   * 生成 YAML Frontmatter
   */
  private generateFrontmatter(skill: Skill): string {
    const lines: string[] = ['---']
    lines.push(`name: ${skill.name}`)
    lines.push(`description: ${this.generateDescription(skill)}`)
    lines.push(`version: ${this.version}`)
    lines.push('---')
    lines.push('')
    return lines.join('\n')
  }

  /**
   * 生成 description 字段
   * 格式：This skill should be used when the user asks to "phrase1", "phrase2", or discusses {topic}.
   */
  private generateDescription(skill: Skill): string {
    const phrases = skill.triggerPhrases.map(p => `"${p}"`).join(', ')
    if (phrases) {
      return `This skill should be used when the user asks to ${phrases}, or discusses ${skill.displayName}.`
    }
    return `This skill should be used when the user discusses ${skill.displayName}.`
  }

  /**
   * 获取 Skill 用途描述
   */
  private getSkillPurpose(skill: Skill): string {
    // 从描述中提取用途，或使用显示名称
    if (skill.description && skill.description.length < 20) {
      return skill.description
    }
    return skill.displayName
  }

  /**
   * 生成执行步骤
   */
  private generateSteps(skill: Skill): string {
    const steps: string[] = []
    let stepNum = 1

    for (const node of skill.nodes) {
      switch (node.type) {
        case 'tool':
          steps.push(`${stepNum}. **${node.name}**`)
          steps.push(`   调用 \`${node.config.toolName}\` 工具`)
          if (node.config.inputMapping) {
            steps.push('')
            steps.push('   参数映射：')
            for (const [key, value] of Object.entries(node.config.inputMapping)) {
              const explained = this.explainMapping(value, skill, node)
              steps.push(`   - ${key} = ${explained}`)
            }
          }
          steps.push('')
          stepNum++
          break

        case 'condition':
          steps.push(`${stepNum}. **条件判断**`)
          steps.push(`   根据条件决定执行路径：`)
          steps.push(`   - 条件: \`${node.config.condition}\``)
          steps.push('')
          stepNum++
          break

        case 'start':
        case 'end':
          // 不生成步骤
          break
      }
    }

    return steps.join('\n')
  }

  /**
   * 获取 Skill 使用的工具列表
   */
  private getUsedTools(skill: Skill): Array<{ name: string; node: SkillNode }> {
    const tools: Array<{ name: string; node: SkillNode }> = []

    for (const node of skill.nodes) {
      if (node.type === 'tool' && node.config.toolName) {
        // 避免重复
        if (!tools.find(t => t.name === node.config.toolName)) {
          tools.push({ name: node.config.toolName, node })
        }
      }
    }

    return tools
  }

  /**
   * 生成工具表格
   */
  private generateToolsTable(skill: Skill, tools: Array<{ name: string; node: SkillNode }>): string {
    const lines: string[] = []
    lines.push('| 工具名 | 说明 | 参数 |')
    lines.push('|--------|------|------|')

    for (const tool of tools) {
      const params = this.getToolParamsDescription(skill, tool.node)
      lines.push(`| ${tool.name} | ${tool.node.name} | ${params} |`)
    }

    return lines.join('\n')
  }

  /**
   * 获取工具参数描述
   */
  private getToolParamsDescription(skill: Skill, node: SkillNode): string {
    if (!node.config.inputMapping) {
      return '-'
    }

    const params = Object.entries(node.config.inputMapping)
      .map(([key]) => key)
      .join(', ')

    return params || '-'
  }

  /**
   * 生成输入参数描述
   */
  private generateInputParams(schema: InputSchema): string {
    const lines: string[] = []
    const required = schema.required || []

    for (const [name, prop] of Object.entries(schema.properties)) {
      const isRequired = required.includes(name)
      const requiredMark = isRequired ? '(必填)' : '(可选)'
      const type = prop.type
      const desc = prop.description || ''

      lines.push(`- **${name}** ${requiredMark}: ${type}${desc ? ` - ${desc}` : ''}`)

      if (prop.enum) {
        lines.push(`  - 可选值: ${prop.enum.join(', ')}`)
      }

      if (prop.default !== undefined) {
        lines.push(`  - 默认值: ${prop.default}`)
      }
    }

    if (lines.length === 0) {
      return '无输入参数'
    }

    return lines.join('\n')
  }

  /**
   * 从 inputMapping 生成输入参数描述
   */
  private generateInputParamsFromMapping(skill: Skill): string {
    const lines: string[] = []

    // 收集所有 inputMapping 中引用的 ${input.xxx} 参数
    const inputParams = new Set<string>()
    for (const node of skill.nodes) {
      if (node.type === 'tool' && node.config.inputMapping) {
        for (const value of Object.values(node.config.inputMapping)) {
          const match = value.match(/\$\{input\.(\w+)\}/)
          if (match) {
            inputParams.add(match[1])
          }
        }
      }
    }

    if (inputParams.size > 0) {
      lines.push('请确保已经提供以下信息：')
      lines.push('')
      for (const param of Array.from(inputParams)) {
        lines.push(`- **${param}**: 从用户输入或上下文中获取`)
      }
    } else {
      const props = Object.entries(skill.inputSchema.properties)
      if (props.length > 0) {
        const required = skill.inputSchema.required || []
        for (const [name, prop] of props) {
          const isRequired = required.includes(name)
          const requiredMark = isRequired ? '(必填)' : '(可选)'
          lines.push(`- **${name}** ${requiredMark}: ${prop.type}${prop.description ? ` - ${prop.description}` : ''}`)
        }
      } else {
        lines.push('此技能不需要额外输入参数。')
      }
    }

    return lines.join('\n')
  }

  /**
   * 生成输出说明
   */
  private generateOutputDescription(endNode: SkillNode): string {
    const lines: string[] = []

    if (endNode.config.outputMapping) {
      lines.push('最终返回结果：')
      lines.push('')
      for (const [key, value] of Object.entries(endNode.config.outputMapping)) {
        const explained = this.explainMappingValue(value)
        lines.push(`- ${key} = ${explained}`)
      }
    } else {
      lines.push('最后一个工具的输出即为最终结果。')
    }

    return lines.join('\n')
  }

  /**
   * 解释映射表达式的含义
   */
  private explainMapping(expression: string, skill: Skill, currentNode: SkillNode): string {
    // ${input.xxx} 格式
    const inputMatch = expression.match(/\$\{input\.(\w+)\}/)
    if (inputMatch) {
      return `${inputMatch[1]}（来自用户输入）`
    }

    // ${nodeId.xxx} 格式
    const nodeMatch = expression.match(/\$\{([\w-]+)\.(\w+)\}/)
    if (nodeMatch) {
      const nodeId = nodeMatch[1]
      const field = nodeMatch[2]
      const prevNode = skill.nodes.find(n => n.id === nodeId)
      if (prevNode) {
        return `${field}（来自上一步 "${prevNode.name}" 的输出）`
      }
      return `${field}（来自节点 ${nodeId} 的输出）`
    }

    // 固定值
    if (expression.startsWith('"') && expression.endsWith('"')) {
      return expression.slice(1, -1) + '（固定值）'
    }

    return expression
  }

  /**
   * 解释映射表达式的含义（简化版，用于输出说明）
   */
  private explainMappingValue(expression: string): string {
    // ${input.xxx} 格式
    const inputMatch = expression.match(/\$\{input\.(\w+)\}/)
    if (inputMatch) {
      return `${inputMatch[1]}（用户输入）`
    }

    // ${nodeId.xxx} 格式
    const nodeMatch = expression.match(/\$\{([\w-]+)\.(\w+)\}/)
    if (nodeMatch) {
      return `${nodeMatch[2]}（来自工具 ${nodeMatch[1]} 的输出）`
    }

    // 固定值
    if (expression.startsWith('"') && expression.endsWith('"')) {
      return expression.slice(1, -1) + '（固定值）'
    }

    return expression
  }

  /**
   * 生成示例
   */
  private generateExample(skill: Skill): string {
    const lines: string[] = []

    // 用户示例输入
    const inputExample = this.generateInputExample(skill)
    lines.push(`用户: "${inputExample}"`)
    lines.push('')
    lines.push('执行流程:')

    // 生成执行步骤
    let stepNum = 1
    for (const node of skill.nodes) {
      if (node.type === 'tool') {
        lines.push(`${stepNum}. ${node.config.toolName}()`)
        stepNum++
      } else if (node.type === 'condition') {
        lines.push(`${stepNum}. 条件判断`)
        stepNum++
      }
    }

    lines.push(`${stepNum}. 返回结果`)

    return lines.join('\n')
  }

  /**
   * 生成输入示例
   */
  private generateInputExample(skill: Skill): string {
    const props = Object.keys(skill.inputSchema.properties)
    if (props.length === 0) {
      return `帮我${skill.displayName}`
    }

    // 使用第一个参数作为示例
    const firstProp = props[0]
    return `帮我${skill.displayName}，${firstProp}是xxx`
  }

  /**
   * 生成 Prompt 模板
   * 当 Skill 配置为 asPrompt 模式时使用
   */
  generatePromptTemplate(skill: Skill): string {
    const lines: string[] = []

    // 角色和任务说明
    lines.push(`# ${skill.displayName}`)
    lines.push('')
    lines.push(skill.description)
    lines.push('')

    // 可用工具列表
    const tools = this.getUsedTools(skill)
    if (tools.length > 0) {
      lines.push('## 可用工具')
      lines.push('')
      lines.push('你需要按顺序调用以下工具：')
      lines.push('')
      for (const tool of tools) {
        lines.push(`- \`${tool.name}\` - ${tool.node.name}`)
      }
      lines.push('')
    }

    // 触发短语
    if (skill.triggerPhrases && skill.triggerPhrases.length > 0) {
      lines.push('## 触发条件')
      lines.push('')
      lines.push('当用户输入以下内容时，执行此技能：')
      lines.push('')
      for (const phrase of skill.triggerPhrases) {
        lines.push(`- "${phrase}"`)
      }
      lines.push('')
    }

    // 参数说明
    lines.push('## 输入参数')
    lines.push('')

    // 收集所有 inputMapping 中引用的 ${input.xxx} 参数
    const inputParams = new Set<string>()
    for (const node of skill.nodes) {
      if (node.type === 'tool' && node.config.inputMapping) {
        for (const value of Object.values(node.config.inputMapping)) {
          const match = value.match(/\$\{input\.(\w+)\}/)
          if (match) {
            inputParams.add(match[1])
          }
        }
      }
    }

    if (inputParams.size > 0) {
      lines.push('在执行前，确保你已经从用户那里获取了以下信息：')
      lines.push('')
      for (const param of Array.from(inputParams)) {
        lines.push(`- **${param}**: 请向用户询问或从上下文中提取此参数`)
      }
      lines.push('')
    } else {
      const props = Object.entries(skill.inputSchema.properties)
      if (props.length > 0) {
        for (const [name, prop] of props) {
          lines.push(`- **${name}**: ${prop.description || prop.type}`)
        }
      } else {
        lines.push('此技能不需要额外输入参数。')
      }
      lines.push('')
    }

    // 执行步骤
    lines.push('## 执行步骤')
    lines.push('')
    lines.push('请按以下顺序执行：')
    lines.push('')
    let stepNum = 1
    for (const node of skill.nodes) {
      if (node.type === 'tool') {
        const tool = tools.find(t => t.name === node.config.toolName)
        lines.push(`${stepNum}. **调用 ${node.config.toolName} 工具**`)
        lines.push('')
        if (node.config.inputMapping) {
          lines.push('   参数映射：')
          for (const [key, value] of Object.entries(node.config.inputMapping)) {
            const explained = this.explainMapping(value, skill, node)
            lines.push(`   - ${key} = ${explained}`)
          }
          lines.push('')
        }
        stepNum++
      } else if (node.type === 'condition') {
        lines.push(`${stepNum}. **条件判断**: ${node.config.condition}`)
        lines.push('')
        stepNum++
      }
    }

    // 输出说明
    const endNode = skill.nodes.find(n => n.type === 'end')
    if (endNode?.config.outputMapping) {
      lines.push('## 输出')
      lines.push('')
      lines.push('最终返回结果：')
      for (const [key, value] of Object.entries(endNode.config.outputMapping)) {
        lines.push(`- ${key} = ${this.explainMapping(value, skill, endNode)}`)
      }
      lines.push('')
    }

    // 使用示例
    lines.push('## 使用示例')
    lines.push('')
    lines.push('**用户**: ' + this.generateInputExample(skill))
    lines.push('')
    lines.push('**助手**: 我将按步骤执行：')
    lines.push('')
    let exampleStep = 1
    for (const node of skill.nodes) {
      if (node.type === 'tool') {
        lines.push(`${exampleStep}. 调用 ${node.config.toolName}...`)
        exampleStep++
      }
    }
    lines.push(`${exampleStep}. 返回结果给用户`)

    return lines.join('\n')
  }

  /**
   * 解释映射表达式的含义
   */
  private explainMapping(expression: string, skill: Skill, currentNode: SkillNode): string {
    // ${input.xxx} 格式
    const inputMatch = expression.match(/\$\{input\.(\w+)\}/)
    if (inputMatch) {
      return `${inputMatch[1]}（来自用户输入）`
    }

    // ${nodeId.xxx} 格式
    const nodeMatch = expression.match(/\$\{([\w-]+)\.(\w+)\}/)
    if (nodeMatch) {
      const nodeId = nodeMatch[1]
      const field = nodeMatch[2]
      const prevNode = skill.nodes.find(n => n.id === nodeId)
      if (prevNode) {
        return `${field}（来自上一步 "${prevNode.name}" 的输出）`
      }
      return `${field}（来自节点 ${nodeId} 的输出）`
    }

    // 固定值
    if (expression.startsWith('"') && expression.endsWith('"')) {
      return expression.slice(1, -1) + '（固定值）'
    }

    return expression
  }
}