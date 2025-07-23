@echo off
cls
echo ======================================
echo  Claude Analytics - Quick Start
echo ======================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

:: Display Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js version: %NODE_VERSION%

:: Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not available
    echo Please ensure npm is installed with Node.js
    pause >nul
    exit /b 1
)

:: Create required directories
echo 📁 Creating required directories...
if not exist "uploads" mkdir uploads
if not exist "reports" mkdir reports
echo ✅ Directories created

:: Check if .env file exists
if not exist ".env" (
    echo 📝 Creating .env template...
    (
        echo # Claude API Configuration
        echo CLAUDE_API_KEY=your_claude_api_key_here
        echo.
        echo # Server Configuration
        echo PORT=5000
        echo NODE_ENV=development
        echo.
        echo # File Upload Limits
        echo MAX_FILE_SIZE=10485760
        echo UPLOAD_DIR=uploads
        echo.
        echo # Report Storage
        echo REPORTS_DIR=reports
        echo.
        echo # CORS Settings
        echo ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000
    ) > .env
    echo ✅ .env template created
    echo ⚠️  You need to add your Claude API key to the .env file
) else (
    echo ✅ .env file already exists
)

:: Install root dependencies
echo.
echo 📦 Installing root dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install root dependencies
    pause
    exit /b 1
)
echo ✅ Root dependencies installed

:: Install client dependencies
echo.
echo 📦 Installing client dependencies...
cd client
call npm install
if errorlevel 1 (
    echo ❌ Failed to install client dependencies
    pause
    exit /b 1
)
cd ..
echo ✅ Client dependencies installed

:: Check for Claude API key
findstr /C:"CLAUDE_API_KEY=your_claude_api_key_here" .env >nul
if not errorlevel 1 (
    echo.
    echo ⚠️  IMPORTANT: Please add your Claude API key to the .env file
    echo    1. Open .env file in a text editor
    echo    2. Replace 'your_claude_api_key_here' with your actual API key
    echo    3. Get your API key from: https://console.anthropic.com/
    echo.
    echo Press any key to continue...
    pause >nul
)

:: Show completion message
echo.
echo 🎉 Setup completed successfully!
echo.
echo 🚀 To start the application:
echo    npm run dev     # Start both server and client
echo    npm run server  # Start server only  
echo    npm run client  # Start client only
echo.
echo 📖 Open http://localhost:3000 in your browser
echo 📚 Check README.md for detailed documentation
echo.

:: Ask if user wants to start the application
set /p START_APP="Would you like to start the application now? (y/n): "
if /i "%START_APP%"=="y" (
    echo.
    echo 🚀 Starting Claude Analytics...
    echo Press Ctrl+C to stop the application
    echo.
    call npm run dev
) else (
    echo.
    echo 👍 You can start the application later with: npm run dev
    echo.
)

echo Press any key to exit...
pause >nul