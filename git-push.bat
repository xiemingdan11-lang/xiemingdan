@echo off
cd /d "%~dp0"
git add -A
git commit -m "fix: server deploy permission + api route cleanup"
git push
pause
