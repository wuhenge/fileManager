@echo off
chcp 65001 >nul
echo ================
echo 开始打包流程...
echo ================

echo.
echo [步骤 1/2] 重新构建前端项目...
cd /d f:\Project\fileManager\frontend
call npm run build
if %errorlevel% neq 0 (
    echo 前端构建失败！
    pause
    exit /b 1
)

echo.
echo [步骤 2/2] 重新打包 fpk...
cd /d f:\Project\fileManager
.\fnpack.exe build
if %errorlevel% neq 0 (
    echo fpk 打包失败！
    pause
    exit /b 1
)

echo.
echo ==========
echo 打包完成！
echo ==========
pause
