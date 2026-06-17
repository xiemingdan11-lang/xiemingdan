@echo off
cd /d "%~dp0"
git add -A
git commit -m "feat: sequential capture order, account name display, sort fix"
git push
pause
