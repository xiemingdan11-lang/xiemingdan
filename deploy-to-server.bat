@echo off
chcp 65001 >nul
setlocal

set SERVER=ubuntu@124.222.223.153
set KEY=%~dp0..\\.ssh-keys\\xmd_server_ed25519

echo.
echo ========================================
echo   部署到腾讯云服务器
echo   %SERVER%
echo ========================================
echo.

:: 检测是否首次部署（服务器上没有 /opt/live-workbench）
echo [1/2] 检测服务器环境...
ssh -o StrictHostKeyChecking=no -i "%KEY%" %SERVER% "test -d /opt/live-workbench && echo EXIST || echo FIRST"
ssh -o StrictHostKeyChecking=no -i "%KEY%" %SERVER% "test -d /opt/live-workbench && echo skip_setup || echo need_setup" > %TEMP%\setup_check.txt
set /p SETUP_STATUS=<%TEMP%\setup_check.txt

if "%SETUP_STATUS%"=="need_setup" (
    echo [初始化] 首次部署，正在安装 Node.js / PM2 / Nginx...
    scp -o StrictHostKeyChecking=no -i "%KEY%" "%~dp0server-setup.sh" %SERVER%:/tmp/server-setup.sh
    ssh -o StrictHostKeyChecking=no -i "%KEY%" %SERVER% "chmod +x /tmp/server-setup.sh && bash /tmp/server-setup.sh"
)

echo.
echo [2/2] 正在拉取代码并部署...
scp -o StrictHostKeyChecking=no -i "%KEY%" "%~dp0deploy-server.sh" %SERVER%:/tmp/deploy-server.sh
ssh -o StrictHostKeyChecking=no -i "%KEY%" %SERVER% "chmod +x /tmp/deploy-server.sh && bash /tmp/deploy-server.sh"

echo.
echo ========================================
echo   完成！访问 http://124.222.223.153
echo ========================================
echo.
pause
