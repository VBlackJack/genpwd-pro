@echo off
:: GenPwd Pro Native Messaging Host Uninstaller

setlocal

set "MANIFEST_NAME=com.genpwdpro.nmh"

:: Check if running as admin
net session >nul 2>&1
if %errorlevel% == 0 (
    set "REG_KEY=HKLM\SOFTWARE\Google\Chrome\NativeMessagingHosts\%MANIFEST_NAME%"
    echo Uninstalling system-wide registration...
) else (
    set "REG_KEY=HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\%MANIFEST_NAME%"
    echo Uninstalling user registration...
)

:: Remove registry entry
reg delete "%REG_KEY%" /f 2>nul

if %errorlevel% == 0 (
    echo.
    echo Uninstallation successful!
) else (
    echo.
    echo Registry key not found or already removed.
)

pause
