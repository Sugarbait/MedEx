@echo off
echo ============================================
echo MedEx Invoice Email Deployment Script
echo ============================================
echo.

echo Step 1: Logging in to Supabase...
call npx supabase login
if errorlevel 1 (
    echo ERROR: Failed to login to Supabase
    echo Please run: npx supabase login
    pause
    exit /b 1
)
echo.

echo Step 2: Linking to project...
call npx supabase link --project-ref onwgbfetzrctshdwwimm
if errorlevel 1 (
    echo WARNING: Project may already be linked
)
echo.

echo Step 3: Deploying send-invoice-email function...
call npx supabase functions deploy send-invoice-email --no-verify-jwt
if errorlevel 1 (
    echo ERROR: Deployment failed
    pause
    exit /b 1
)
echo.

echo ============================================
echo Deployment Complete!
echo ============================================
echo.
echo The invoice email function has been deployed with:
echo - Sender: MedEx CRM ^<aibot@phaetonai.com^>
echo - Professional ARTLEE-style formatting
echo - MedEx logo and Phaeton AI branding
echo.
echo Next steps:
echo 1. Test the invoice generation from Dashboard
echo 2. Check elitesquadp@protonmail.com for test email
echo 3. Verify email formatting and branding
echo.
pause
