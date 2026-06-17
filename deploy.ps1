Set-Location $PSScriptRoot
Write-Host "=== Git status ===" -ForegroundColor Cyan
git status
Write-Host ""
Write-Host "=== Adding files ===" -ForegroundColor Cyan
git add app/page.tsx next.config.mjs
Write-Host ""
Write-Host "=== Committing ===" -ForegroundColor Cyan
git commit -m "feat: redesign display mode - 9:16 cards + ambient color + glassmorphism UI"
Write-Host ""
Write-Host "=== Pushing to GitHub ===" -ForegroundColor Cyan
git push origin main
Write-Host ""
Write-Host "=== Done! Vercel will auto-deploy. ===" -ForegroundColor Green
Read-Host "Press Enter to close"
