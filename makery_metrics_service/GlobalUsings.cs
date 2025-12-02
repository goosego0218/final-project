// ------------------------------
// GlobalUsings.cs
// 프로젝트 전역에서 자주 쓰는 네임스페이스 모음
// 각 파일마다 using 반복 안 해도 되도록 global using으로 선언
// ------------------------------

// 기본 BCL (기본 타입, 시간/스레드/Task 등)
global using System;
global using System.Threading;
global using System.Threading.Tasks;

// .NET Generic Host 관련
// - IHost, BackgroundService 등 호스팅 인프라
global using Microsoft.Extensions.Hosting;

// 로깅 / 설정 / DI 컨테이너
// - ILogger<T>, IConfiguration, IServiceCollection 확장 메서드(AddHostedService 등)
global using Microsoft.Extensions.Logging;
global using Microsoft.Extensions.Configuration;
global using Microsoft.Extensions.DependencyInjection;

// Oracle Managed Driver
// - OracleConnection, OracleCommand 등 오라클 DB 연결/쿼리용
global using Oracle.ManagedDataAccess.Client;