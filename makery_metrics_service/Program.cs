// makery_metrics_service 애플리케이션의 진입점(Program.cs)
// - .NET Generic Host를 구성하고
// - DI 컨테이너를 설정한 뒤
// - BackgroundService(Worker)를 실행합니다.

using makery_metrics_service;
using makery_metrics_service.Services.Metrics;
using makery_metrics_service.Services.Social;
using makery_metrics_service.Services.TikTok;
using makery_metrics_service.Services.YouTube;

// Host 빌더 생성 (.NET 8 Generic Host)
var builder = Host.CreateApplicationBuilder(args);

// appsettings.json 의 "ConnectionStrings:OracleDb" 값을 사용해
// OracleConnection 을 DI 컨테이너에 등록합니다.
builder.Services.AddScoped<OracleConnection>(sp =>
{
    var config = builder.Configuration;
    var connStr = config.GetConnectionString("OracleDb");
    return new OracleConnection(connStr);
});

// social_post 조회용 리포지토리 등록
builder.Services.AddSingleton<ISocialPostRepository, OracleSocialPostRepository>();

// social_connection 조회용 리포지토리 등록 (TikTok 토큰 복호화용)
builder.Services.AddSingleton<ISocialConnectionRepository, OracleSocialConnectionRepository>();

// social_post_metric 저장용 리포지토리 등록
builder.Services.AddSingleton<ISocialMetricsRepository, OracleSocialMetricsRepository>();

// 메트릭 수집 상위 서비스 등록
builder.Services.AddSingleton<IMetricsCollectionService, MetricsCollectionService>();

// YouTube 메트릭 클라이언트 등록
builder.Services.AddSingleton<IYouTubeMetricsClient, YouTubeMetricsClient>();

// TikTok 메트릭 클라이언트 등록
builder.Services.AddSingleton<ITikTokMetricsClient, TikTokMetricsClient>();

// Worker 등록 (BackgroundService 실행)
builder.Services.AddHostedService<Worker>();

// Host 빌드 및 실행
var host = builder.Build();
host.Run();
