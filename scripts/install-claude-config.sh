#!/bin/bash
# 安装 MCP Bridge 配置到 Claude Desktop
#
# 用法:
#   ./scripts/install-claude-config.sh      # 安装配置
#   ./scripts/install-claude-config.sh -u   # 卸载配置

set -e

# 配置路径
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_CONFIG="$PROJECT_DIR/claude_desktop_config.json"
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
BACKUP_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json.backup"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 卸载配置
uninstall() {
    log_info "卸载 MCP Bridge 配置..."

    if [ -f "$BACKUP_CONFIG" ]; then
        log_info "恢复备份配置..."
        mv "$BACKUP_CONFIG" "$CLAUDE_CONFIG"
        log_info "✅ 已恢复原始配置"
    elif [ -f "$CLAUDE_CONFIG" ]; then
        # 从配置中移除 mcp-bridge
        if command -v node &> /dev/null; then
            node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$CLAUDE_CONFIG', 'utf8'));
if (config.mcpServers && config.mcpServers['mcp-bridge']) {
    delete config.mcpServers['mcp-bridge'];
    fs.writeFileSync('$CLAUDE_CONFIG', JSON.stringify(config, null, 2));
    console.log('已从配置中移除 mcp-bridge');
} else {
    console.log('配置中没有 mcp-bridge');
}
"
        fi
        log_info "✅ 已移除 mcp-bridge 配置"
    else
        log_warn "没有找到 Claude 配置文件"
    fi

    echo ""
    log_info "请重启 Claude Desktop 使配置生效"
}

# 安装配置
install() {
    log_info "安装 MCP Bridge 配置到 Claude Desktop..."
    echo ""

    # 检查项目配置文件
    if [ ! -f "$PROJECT_CONFIG" ]; then
        log_error "项目配置文件不存在: $PROJECT_CONFIG"
        exit 1
    fi

    # 创建 Claude 配置目录
    if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
        log_info "创建 Claude 配置目录..."
        mkdir -p "$CLAUDE_CONFIG_DIR"
    fi

    # 检查现有配置
    if [ -f "$CLAUDE_CONFIG" ]; then
        # 备份现有配置
        if [ ! -f "$BACKUP_CONFIG" ]; then
            log_info "备份现有配置..."
            cp "$CLAUDE_CONFIG" "$BACKUP_CONFIG"
        fi

        # 合并配置
        log_info "合并配置..."
        node -e "
const fs = require('fs');
const existing = JSON.parse(fs.readFileSync('$CLAUDE_CONFIG', 'utf8'));
const project = JSON.parse(fs.readFileSync('$PROJECT_CONFIG', 'utf8'));

// 合并 mcpServers
existing.mcpServers = existing.mcpServers || {};
Object.assign(existing.mcpServers, project.mcpServers);

fs.writeFileSync('$CLAUDE_CONFIG', JSON.stringify(existing, null, 2));
console.log('✅ 配置已合并');
"
    else
        # 直接复制
        log_info "创建新配置..."
        cp "$PROJECT_CONFIG" "$CLAUDE_CONFIG"
    fi

    echo ""
    log_info "✅ 安装完成!"
    echo ""
    echo "配置内容:"
    cat "$CLAUDE_CONFIG"
    echo ""
    echo "=========================================="
    log_info "请重启 Claude Desktop 使配置生效"
    echo "=========================================="
}

# 主逻辑
case "$1" in
    -u|--uninstall)
        uninstall
        ;;
    *)
        install
        ;;
esac