@echo off
echo ===================================
echo NRAYO Full Deploy Starting
echo ===================================

cd /d C:\temp\files\NRAYO
echo.
echo [1/4] GitHub push...
git add -A
git commit -m "update"
git push

echo.
echo [2/4] Deploying backend to Cloud Run... (may take a few minutes)
cd backend
call gcloud run deploy nrayo-backend --source . --region asia-northeast3 --allow-unauthenticated

echo.
echo [3/4] Deploying frontend to Firebase Hosting...
cd ..\frontend\public
call firebase deploy --only hosting

echo.
echo [4/4] Deploy complete!
echo Service: https://nrayo-3c940.web.app
echo Admin: https://nrayo-3c940.web.app/admin/
echo ===================================
pause
