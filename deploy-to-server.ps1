# Deploy to Tencent Cloud Server
$SERVER = "ubuntu@124.222.223.153"
$KEY    = Join-Path $PSScriptRoot "..\\.ssh-keys\\xmd_server_ed25519"
$SETUP  = Join-Path $PSScriptRoot "server-setup.sh"
$DEPLOY = Join-Path $PSScriptRoot "deploy-server.sh"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Deploying to $SERVER" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if first-time setup is needed
Write-Host "[1/2] Checking server environment..." -ForegroundColor Yellow
$isFirst = & ssh -o StrictHostKeyChecking=no -i $KEY $SERVER "test -d /opt/live-workbench && echo EXIST || echo FIRST" 2>&1

if ($isFirst -match "FIRST") {
    Write-Host "      First deployment - installing Node.js / PM2 / Nginx..." -ForegroundColor Yellow
    & scp -o StrictHostKeyChecking=no -i $KEY $SETUP "${SERVER}:/tmp/server-setup.sh"
    & ssh -o StrictHostKeyChecking=no -i $KEY $SERVER "chmod +x /tmp/server-setup.sh && bash /tmp/server-setup.sh"
} else {
    Write-Host "      Environment ready, skipping setup." -ForegroundColor Green
}

# Step 2: Deploy
Write-Host ""
Write-Host "[2/2] Pulling code and building..." -ForegroundColor Yellow
& scp -o StrictHostKeyChecking=no -i $KEY $DEPLOY "${SERVER}:/tmp/deploy-server.sh"
& ssh -o StrictHostKeyChecking=no -i $KEY $SERVER "chmod +x /tmp/deploy-server.sh && bash /tmp/deploy-server.sh"

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Done!  http://124.222.223.153" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to close"
