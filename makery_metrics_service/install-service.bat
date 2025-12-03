@echo off
set EXE_PATH=%~dp0bin\Release\net10.0\makery_metrics_service.exe
sc.exe create MakeryMetricsService binPath= "%EXE_PATH%" start= auto DisplayName= "Makery Metrics Service"
sc.exe start MakeryMetricsService
pause