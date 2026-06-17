@echo off
cd /d "%~dp0"
git add -A
git commit -m "feat: show author name below timestamp on cards"
git push
pause
