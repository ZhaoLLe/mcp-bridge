#!/bin/bash
# 使用 MCP Inspector 验证

echo "=== MCP Inspector 验证步骤 ==="
echo ""
echo "1. 安装 MCP Inspector:"
echo "   npm install -g @modelcontextprotocol/inspector"
echo ""
echo "2. 运行 Inspector:"
echo "   npx @modelcontextprotocol/inspector"
echo ""
echo "3. 在浏览器中打开 Inspector (通常是 http://localhost:5173)"
echo ""
echo "4. 连接配置:"
echo "   Transport Type: SSE"
echo "   URL: http://localhost:3000/sse"
echo ""
echo "5. 连接后可以看到工具列表，点击工具可以测试调用"
echo ""

# 检查是否安装了 npx
if command -v npx &> /dev/null; then
    echo "检测到 npx，是否现在启动 Inspector? (y/n)"
    read -r answer
    if [ "$answer" = "y" ]; then
        npx @modelcontextprotocol/inspector
    fi
fi