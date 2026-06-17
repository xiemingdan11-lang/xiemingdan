#!/bin/bash
# ============================================================
# 腾讯云首次初始化脚本（只需运行一次）
# 系统：Ubuntu 20.04/22.04
# ============================================================

set -e

echo "=== 安装 Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== 安装 PM2 ==="
sudo npm install -g pm2

echo "=== 安装 nginx ==="
sudo apt-get install -y nginx

echo "=== 配置 nginx 反向代理 ==="
sudo tee /etc/nginx/sites-available/live-workbench > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/live-workbench /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "=== 设置 PM2 开机自启 ==="
sudo pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "✅ 初始化完成，现在运行 deploy-server.sh 部署应用"
