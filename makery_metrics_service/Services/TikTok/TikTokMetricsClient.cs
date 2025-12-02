namespace makery_metrics_service.Services.TikTok;

/// <summary>
/// TikTok 영상 메트릭을 조회하는 기본 클라이언트 구현체.
/// 현재는 기본 틀만 구현되어 있으며, 실제 API 호출 로직은 추후 추가 예정입니다.
/// </summary>
public class TikTokMetricsClient : ITikTokMetricsClient
{
    private readonly IConfiguration _config;
    private readonly ILogger<TikTokMetricsClient> _logger;

    public TikTokMetricsClient(
        IConfiguration config,
        ILogger<TikTokMetricsClient> logger
    )
    {
        _config = config;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<TikTokVideoMetrics?> GetMetricsAsync(
        string videoId,
        CancellationToken ct = default
    )
    {
        if (string.IsNullOrWhiteSpace(videoId))
        {
            _logger.LogWarning("[TikTokMetricsClient] videoId 가 비어 있습니다.");
            return null;
        }

        _logger.LogInformation("[TikTokMetricsClient] TikTok 메트릭 조회 (기본 틀) - videoId={VideoId}", videoId);

        // TODO: 실제 TikTok API 호출 로직 구현 예정
        // 현재는 실행만 되도록 null 반환
        await Task.CompletedTask;
        return null;
    }
}
