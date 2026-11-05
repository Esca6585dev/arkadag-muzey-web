@echo off
rem Double-click or run "run.bat [dev|prod|stop|status]". All logic lives in run.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1" %*
if errorlevel 1 pause
