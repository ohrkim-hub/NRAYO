@echo off
if "%~1"=="" (
  echo Drag and drop the zip file onto this icon to extract, deploy, and verify automatically.
  pause
  exit /b
)

echo ===================================
echo STEP 1/4: Extracting zip...
echo ===================================
powershell -NoProfile -Command "Expand-Archive -LiteralPath '%~1' -DestinationPath 'C:\temp\files\NRAYO' -Force"

echo.
echo ===================================
echo STEP 2/4: Git push...
echo ===================================
cd /d C:\temp\files\NRAYO
git add -A
git commit -m "update"
git push

echo.
echo ===================================
echo STEP 3/4: Deploying backend (Cloud Run)...
echo ===================================
cd backend
call gcloud run deploy nrayo-backend --source . --region asia-northeast3 --allow-unauthenticated

echo.
echo ===================================
echo STEP 4/4: Deploying frontend (Firebase Hosting)...
echo ===================================
cd ..\frontend\public
call firebase deploy --only hosting

echo.
echo ===================================
echo VERIFYING deployment automatically...
echo ===================================
powershell -NoProfile -Command "$r = Invoke-WebRequest -Uri 'https://nrayo-3c940.web.app/?nocache=$(Get-Random)' -UseBasicParsing; if ($r.Content -match 'AIzaSy') { Write-Host 'PASS: real Firebase API key found on live site.' -ForegroundColor Green } else { Write-Host 'FAIL: placeholder or old file still live! Something is wrong.' -ForegroundColor Red }"

echo.
echo ===================================
echo ALL DONE.
echo Service: https://nrayo-3c940.web.app
echo Admin:   https://nrayo-3c940.web.app/admin/
echo ===================================
pause
