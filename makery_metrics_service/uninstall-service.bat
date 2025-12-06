@echo off
sc.exe stop MakeryMetricsService
timeout /t 2 /nobreak >nul
sc.exe delete MakeryMetricsService
pause