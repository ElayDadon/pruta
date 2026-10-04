@echo off
rem Pruta - starts the local server (run.py) and opens the browser.
rem The window stays open while Pruta runs; closing it stops the server.
title Pruta
cd /d "%~dp0"

if not exist "run.py" (
  echo.
  echo   run.py was not found next to this file.
  echo   If you opened this file from inside the zip: extract the whole zip first.
  echo   Right-click the zip, choose "Extract All", then run start-windows.bat
  echo   from the extracted folder.
  echo.
  pause
  goto :eof
)

rem Each candidate is asked to run one line of Python 3 first. A missing command, a Python 2,
rem and the Microsoft Store placeholder that Windows puts on PATH all fail this check quietly.
py -3 -c "import sys; sys.exit(sys.version_info[0] != 3)" >nul 2>nul
if not errorlevel 1 (
  py -3 run.py
  goto finished
)
python -c "import sys; sys.exit(sys.version_info[0] != 3)" >nul 2>nul
if not errorlevel 1 (
  python run.py
  goto finished
)
python3 -c "import sys; sys.exit(sys.version_info[0] != 3)" >nul 2>nul
if not errorlevel 1 (
  python3 run.py
  goto finished
)

echo.
echo   Python 3 was not found on this computer.
echo.
echo   Either install it from https://www.python.org/downloads/
echo   (tick "Add python.exe to PATH" in the installer) and run this file again,
echo   or simply double-click index.html - everything works there too,
echo   only the data is kept in the browser instead of in this folder.
echo.
pause
goto :eof

:finished
if errorlevel 1 (
  echo.
  echo   Pruta stopped with an error. The message above says why.
  echo   You can still use it by double-clicking index.html.
  echo.
  pause
)
