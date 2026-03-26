#!/bin/bash
# 端到端测试脚本
# 使用前请确保：
# 1. 服务运行中: npm run dev
# 2. 浏览器打开 sdk/test.html 并点击"连接"

echo "等待 5 秒让你确认前端已连接..."
sleep 5

echo ""
echo "=== 调用 get_weather 工具 ==="
echo "参数: { city: '北京' }"
echo ""

curl -s -X POST http://localhost:3000/api/tools/get_weather/invoke \
  -H "Content-Type: application/json" \
  -d '{"city": "北京"}'

echo ""
echo ""
echo "请检查浏览器页面，应该能看到工具执行请求"