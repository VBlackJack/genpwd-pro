@echo off
:: GenPwd Pro Native Messaging Host Launcher
:: This script launches the Node.js native messaging host

:: Get the directory of this batch file
set "SCRIPT_DIR=%~dp0"

:: Run the Node.js script
node "%SCRIPT_DIR%genpwd-native-host.js" %*
