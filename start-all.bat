@echo off
echo ============================
echo  SwiftTrack - Start All Services
echo ============================

echo Starting Products Backend (port 5999)...
start "Products" cmd /k "cd /d %~dp0products && npm install && npm start"

echo Starting CMS (port 8000)...
start "CMS" cmd /k "cd /d %~dp0cms && pip install -r requirements.txt && python app.py"

echo Starting ROS (port 8001)...
start "ROS" cmd /k "cd /d %~dp0ros && pip install -r requirements.txt && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"

echo Starting WMS (port 9999)...
start "WMS" cmd /k "cd /d %~dp0wms && pip install -r requirements.txt && python tcp_server.py"

echo Waiting 5 seconds for backends to initialise...
timeout /t 5 /nobreak > nul

echo Starting ESB (port 8290)...
start "ESB" cmd /k "cd /d %~dp0esb && npm install && npm start"

echo Waiting 3 seconds for ESB to initialise...
timeout /t 3 /nobreak > nul

echo Starting Web App (port 3000)...
start "WebApp" cmd /k "cd /d %~dp0web && npm install && npm start"

echo Starting Driver App (port 3001)...
start "DriverApp" cmd /k "cd /d %~dp0driver && npm install && npm start"

echo.
echo All services launched!
echo   Web App (Customer) -> http://localhost:3000
echo   Driver App         -> http://localhost:3001
echo   ESB / API          -> http://localhost:8290
echo   CMS (SOAP)         -> http://localhost:8000
echo   ROS                -> http://localhost:8001
echo   WMS (TCP)          -> localhost:9999
echo   Products           -> http://localhost:5999
echo.
pause
