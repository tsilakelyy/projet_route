@echo off
setlocal

set "PROJECT_ROOT=%~dp0.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"

if not exist C:\proute (
  mklink /J C:\proute "%PROJECT_ROOT%"
)

start "" explorer.exe C:\proute
