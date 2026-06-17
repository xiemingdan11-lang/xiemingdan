@echo off
cd /d "%~dp0"
git add -A
git commit -m "fix: remove strict keyword filter in search capture; add Tencent Cloud deploy scripts"
git push
pause
