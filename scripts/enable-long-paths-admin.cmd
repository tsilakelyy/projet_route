@echo off
setlocal

reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f
if errorlevel 1 (
  echo Echec de l'activation de LongPathsEnabled.
  echo Lance ce script en tant qu'administrateur Windows.
  exit /b 1
)

echo LongPathsEnabled active.
echo Redemarre Windows pour que l'Explorateur applique bien le changement.
