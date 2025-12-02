using makery_metrics_service.Services;
using makery_metrics_service.Services.Metrics;

namespace makery_metrics_service;

/// <summary>
/// 백그라운드로 주기적인 작업을 수행하는 워커 서비스.
/// 현재는 Oracle DB에서 수집 대상 social_post만 조회하여 로그로 출력합니다.
/// 이후 단계에서 YouTube/TikTok API를 호출해 메트릭을 수집하고
/// social_post_metric 테이블에 저장하는 로직을 추가하게 됩니다.
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
        _logger.LogInformation("[Worker] 시작");

        // 1) 메트릭 수집 서비스에게 한 번의 배치 실행을 위임
        await _metricsService.RunOnceAsync(stoppingToken);

        _logger.LogInformation("[Worker] 한 번 실행 후 종료 (현재는 단발성 테스트 모드)");
        // 추후에는 while 루프로 주기적인 수집 작업을 수행하도록 변경 예정입니다.
    }
}
