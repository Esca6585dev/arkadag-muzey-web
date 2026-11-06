@echo off
rem Double-click or run "deploy\remote-deploy.bat [-Push] [-Import] [-Diagnose]". Logic lives in remote-deploy.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0remote-deploy.ps1" %*
if errorlevel 1 pause
