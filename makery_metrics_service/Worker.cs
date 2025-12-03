using makery_metrics_service.Services;
using makery_metrics_service.Services.Metrics;

namespace makery_metrics_service;

/// <summary>
/// 백그라운드로 주기적인 작업을 수행하는 워커 서비스.
/// 테스트용으로 1분마다 메트릭 수집 배치를 실행합니다.
/// </summary>
public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly IMetricsCollectionService _metricsService;

    public Worker(
        ILogger<Worker> logger,
        IMetricsCollectionService metricsService
    )
    {
        _logger = logger;
        _metricsService = metricsService;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[Worker] 시작 (1분 간격 실행 모드)");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await _metricsService.RunOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Worker] 메트릭 수집 배치 중 오류 발생");
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("[Worker] 종료");
    }
}
