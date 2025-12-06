using makery_metrics_service.Services;
using makery_metrics_service.Services.Metrics;

namespace makery_metrics_service;

/// <summary>
/// 백그라운드로 주기적인 작업을 수행하는 워커 서비스.
/// appsettings.json의 Schedule:DailyRunTime 설정값에 따라 매일 지정된 시간에 메트릭 수집 배치를 실행합니다.
/// </summary>
public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly IMetricsCollectionService _metricsService;
    private readonly IConfiguration _config;

    public Worker(
        ILogger<Worker> logger,
        IMetricsCollectionService metricsService,
        IConfiguration config
    )
    {
        _logger = logger;
        _metricsService = metricsService;
        _config = config;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var scheduledTime = GetScheduledTime();
        _logger.LogInformation(
            "[Worker] 시작 (매일 {ScheduledTime} 실행 모드)",
            $"{scheduledTime.Hours:D2}:{scheduledTime.Minutes:D2}"
        );

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // 다음 실행 예정 시간까지 대기
                var nextRunTime = GetNextScheduledTime();
                var delay = nextRunTime - DateTime.Now;

                if (delay.TotalMilliseconds > 0)
                {
                    _logger.LogInformation(
                        "[Worker] 다음 실행 예정 시간: {NextRunTime} (대기 시간: {DelayMinutes}분 {DelaySeconds}초)",
                        nextRunTime,
                        (int)delay.TotalMinutes,
                        (int)delay.TotalSeconds % 60
                    );
                    await Task.Delay(delay, stoppingToken);
                }
                else if (delay.TotalMilliseconds < 0)
                {
                    // 이미 예정 시간이 지났으면 바로 실행
                    _logger.LogWarning(
                        "[Worker] 예정 시간이 이미 지났습니다. 즉시 실행합니다. (지연: {DelaySeconds}초)",
                        (int)Math.Abs(delay.TotalSeconds)
                    );
                }
                else
                {
                    // delay == 0 (정확히 예정 시간)
                    _logger.LogInformation(
                        "[Worker] 예정 시간 도달. 즉시 실행합니다."
                    );
                }

                // 예정 시간이 되면 전체 메트릭 수집 배치 실행 (배치로 나눠서 반복 처리)
                _logger.LogInformation("[Worker] 전체 메트릭 수집 시작");
                await RunAllBatchesAsync(stoppingToken);
                _logger.LogInformation("[Worker] 전체 메트릭 수집 완료");

                // 다음 실행 예정 시각 계산 및 로그 출력 (항상 출력)
                var nextScheduledTime = GetNextScheduledTime();
                var nextDelay = nextScheduledTime - DateTime.Now;
                _logger.LogInformation(
                    "[Worker] 다음 실행 예정 시각: {NextRunTime} (대기 시간: {DelayHours}시간 {DelayMinutes}분)",
                    nextScheduledTime,
                    (int)nextDelay.TotalHours,
                    (int)nextDelay.TotalMinutes % 60
                );
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Worker] 메트릭 수집 배치 중 오류 발생");
                // 오류 발생 시에도 다음 실행 예정 시간까지 대기 (무한 재시도 방지)
                try
                {
                    var nextRunTime = GetNextScheduledTime();
                    var delay = nextRunTime - DateTime.Now;
                    if (delay.TotalMilliseconds > 0)
                    {
                        await Task.Delay(delay, stoppingToken);
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        _logger.LogInformation("[Worker] 종료");
    }

    /// <summary>
    /// 전체 메트릭 수집을 배치로 나눠서 반복 처리합니다.
    /// TikTok API rate limit을 고려하여 각 배치 사이에 대기 시간을 둡니다.
    /// </summary>
    private async Task RunAllBatchesAsync(CancellationToken stoppingToken)
    {
        const int batchDelaySeconds = 60; // TikTok API rate limit 고려: 배치 사이 1분 대기
        int batchNumber = 0;
        int totalProcessed = 0;

        while (!stoppingToken.IsCancellationRequested)
        {
            batchNumber++;
            _logger.LogInformation("[Worker] 배치 #{BatchNumber} 시작", batchNumber);

            try
            {
                // 한 배치 실행
                var processedCount = await _metricsService.RunOnceAsync(stoppingToken);

                if (processedCount == 0)
                {
                    // 더 이상 처리할 데이터가 없음
                    _logger.LogInformation(
                        "[Worker] 더 이상 처리할 데이터가 없습니다. 전체 배치 처리 완료 (총 {BatchCount}개 배치, {TotalProcessed}건 처리)",
                        batchNumber - 1,
                        totalProcessed
                    );
                    break;
                }

                totalProcessed += processedCount;
                _logger.LogInformation(
                    "[Worker] 배치 #{BatchNumber} 완료 - 처리 건수: {ProcessedCount}, 누적: {TotalProcessed}",
                    batchNumber,
                    processedCount,
                    totalProcessed
                );

                // 배치 사이 대기 (rate limit 방지)
                if (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogInformation(
                        "[Worker] 다음 배치까지 {DelaySeconds}초 대기 (rate limit 방지)",
                        batchDelaySeconds
                    );
                    await Task.Delay(TimeSpan.FromSeconds(batchDelaySeconds), stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Worker] 배치 #{BatchNumber} 중 오류 발생", batchNumber);
                // 오류 발생 시에도 다음 배치로 진행 (전체 중단 방지)
                if (!stoppingToken.IsCancellationRequested)
                {
                    await Task.Delay(TimeSpan.FromSeconds(batchDelaySeconds), stoppingToken);
                }
            }
        }

        _logger.LogInformation(
            "[Worker] 전체 배치 처리 완료 - 총 {BatchCount}개 배치, {TotalProcessed}건 처리",
            batchNumber,
            totalProcessed
        );
    }

    /// <summary>
    /// appsettings.json에서 설정된 실행 시간을 읽어옵니다.
    /// </summary>
    private TimeSpan GetScheduledTime()
    {
        var runTimeStr = _config["Schedule:DailyRunTime"] ?? "00:00";

        if (TimeSpan.TryParse(runTimeStr, out var scheduledTime))
        {
            return scheduledTime;
        }

        // 파싱 실패 시 기본값 00:00 사용
        _logger.LogWarning(
            "[Worker] Schedule:DailyRunTime 설정값 '{RunTime}' 파싱 실패. 기본값 00:00 사용",
            runTimeStr
        );
        return TimeSpan.Zero;
    }

    /// <summary>
    /// 다음 실행 예정 시간을 계산합니다.
    /// appsettings.json의 Schedule:DailyRunTime 설정값을 사용하며,
    /// 설정이 없으면 기본값 00:00을 사용합니다.
    /// </summary>
    private DateTime GetNextScheduledTime()
    {
        var scheduledTime = GetScheduledTime();
        var now = DateTime.Now;
        var todayScheduled = new DateTime(
            now.Year,
            now.Month,
            now.Day,
            scheduledTime.Hours,
            scheduledTime.Minutes,
            0
        );

        // 현재 시간이 이미 예정 시간 이후면 내일 예정 시간 반환
        if (now >= todayScheduled)
        {
            return todayScheduled.AddDays(1);
        }

        // 아직 오늘 예정 시간이 안 지났으면 오늘 예정 시간 반환
        return todayScheduled;
    }
}
