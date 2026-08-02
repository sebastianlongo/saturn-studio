@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === Astro.med ===
echo.

if not exist "node_modules\" (
  echo Instalando dependencias ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo ERROR: No se pudo instalar. ¿Tienes Node.js instalado? https://nodejs.org
    pause
    exit /b 1
  )
)

echo Iniciando servidor y abriendo el navegador...
echo Si no se abre solo, mira la URL debajo ^(http://localhost:...^)
echo Para cerrar el servidor: Ctrl+C
echo.
call npm run dev
pause
