#!/bin/bash
# ============================================================
# 腾讯云服务器部署脚本
# 用法：在服务器上运行一次 server-setup.sh，之后每次更新运行此脚本
# 访问地址：http://124.222.223.153（或 http://服务器IP）
# ============================================================

set -e
APP_DIR="/opt/live-workbench"
REPO="https://github.com/xiemingdan1-lang/xiemingdan.git"

echo "=== 拉取最新代码 ==="
sudo chown -R $USER:$USER "$APP_DIR" 2>/dev/null || true
git config --global --add safe.directory "$APP_DIR" 2>/dev/null || true
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "=== 安装依赖 ==="
npm ci --omit=dev

echo "=== 构建 ==="
npm run build

echo "=== 重启应用 ==="
pm2 restart live-workbench 2>/dev/null || \
  pm2 start npm --name live-workbench -- start -- -p 3000

pm2 save

echo ""
echo "✅ 部署完成，访问 http://$(curl -s ifconfig.me) 即可（无需翻墙）"
