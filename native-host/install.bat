@echo off
:: GenPwd Pro Native Messaging Host Installer
:: Run as Administrator to install system-wide, or as user for user-only install

setlocal enabledelayedexpansion

echo.
echo ======================================
echo  GenPwd Pro Native Messaging Installer
echo ======================================
echo.

:: Get the directory of this script
set "INSTALL_DIR=%~dp0"
set "MANIFEST_NAME=com.genpwdpro.nmh"
set "MANIFEST_FILE=%INSTALL_DIR%%MANIFEST_NAME%.json"

:: Check if running as admin
net session >nul 2>&1
if %errorlevel% == 0 (
    set "REG_KEY=HKLM\SOFTWARE\Google\Chrome\NativeMessagingHosts\%MANIFEST_NAME%"
    echo Mode: System-wide installation
) else (
    set "REG_KEY=HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\%MANIFEST_NAME%"
    echo Mode: Current user only
)

echo.
echo To find your Chrome extension ID:
echo   1. Open Chrome and go to chrome://extensions/
echo   2. Enable "Developer mode" (toggle in top right)
echo   3. Find GenPwd Pro and copy the 32-character ID
echo.

set /p EXT_ID="Enter your Chrome extension ID (or press Enter to skip): "

if "!EXT_ID!"=="" (
    set "EXT_ID=EXTENSION_ID_PLACEHOLDER"
    echo.
    echo Skipped. You will need to manually edit:
    echo   %MANIFEST_FILE%
)

:: Update manifest with correct path
set "BAT_PATH=%INSTALL_DIR%genpwd-native-host.bat"
set "BAT_PATH_ESCAPED=!BAT_PATH:\=\\!"

:: Create updated manifest
echo {> "%MANIFEST_FILE%.tmp"
echo   "name": "%MANIFEST_NAME%",>> "%MANIFEST_FILE%.tmp"
echo   "description": "GenPwd Pro Native Messaging Host",>> "%MANIFEST_FILE%.tmp"
echo   "path": "!BAT_PATH_ESCAPED!",>> "%MANIFEST_FILE%.tmp"
echo   "type": "stdio",>> "%MANIFEST_FILE%.tmp"
echo   "allowed_origins": [>> "%MANIFEST_FILE%.tmp"
echo     "chrome-extension://!EXT_ID!/">> "%MANIFEST_FILE%.tmp"
echo   ]>> "%MANIFEST_FILE%.tmp"
echo }>> "%MANIFEST_FILE%.tmp"

move /y "%MANIFEST_FILE%.tmp" "%MANIFEST_FILE%" >nul

:: Register in Windows Registry
reg add "%REG_KEY%" /ve /t REG_SZ /d "%MANIFEST_FILE%" /f

if %errorlevel% == 0 (
    echo.
    echo ======================================
    echo  Installation successful!
    echo ======================================
    echo.
    echo Registry key: %REG_KEY%
    echo Manifest: %MANIFEST_FILE%
    if "!EXT_ID!"=="EXTENSION_ID_PLACEHOLDER" (
        echo.
        echo NOTE: Remember to update the extension ID in the manifest file!
    )
    echo.
    echo Please restart Chrome to load the native messaging host.
) else (
    echo.
    echo Installation failed. Error code: %errorlevel%
)

echo.
pause
