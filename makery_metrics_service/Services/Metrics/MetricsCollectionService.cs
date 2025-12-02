using makery_metrics_service.Services.Social;
using makery_metrics_service.Services.TikTok;
using makery_metrics_service.Services.YouTube;

namespace makery_metrics_service.Services.Metrics;

/// <summary>
/// 메트릭 수집 상위 서비스의 기본 구현체입니다.
/// - ISocialPostRepository 를 통해 수집 대상 social_post 를 조회하고
/// - YouTube/TikTok API를 호출해 메트릭을 수집한 뒤
/// - ISocialMetricsRepository 를 통해 social_post_metric 테이블에 저장합니다.
/// 커서 기반 페이징을 사용하여 중복 처리를 방지합니다.
/// </summary>
public class MetricsCollectionService : IMetricsCollectionService
{
    private readonly ILogger<MetricsCollectionService> _logger;
    private readonly ISocialPostRepository _socialPostRepository;
    private readonly IYouTubeMetricsClient _youTubeMetricsClient;
    private readonly ITikTokMetricsClient _tikTokMetricsClient;
    private readonly ISocialMetricsRepository _metricsRepository;

    // 커서 기반 페이징을 위한 마지막 처리된 post_id (Singleton이므로 메모리에 유지됨)
    private int? _lastProcessedPostId;

    public MetricsCollectionService(
        ILogger<MetricsCollectionService> logger,
        ISocialPostRepository socialPostRepository,
        IYouTubeMetricsClient youTubeMetricsClient,
        ITikTokMetricsClient tikTokMetricsClient,
        ISocialMetricsRepository metricsRepository
    )
    {
        _logger = logger;
        _socialPostRepository = socialPostRepository;
        _youTubeMetricsClient = youTubeMetricsClient;
        _tikTokMetricsClient = tikTokMetricsClient;
        _metricsRepository = metricsRepository;
    }

    public async Task RunOnceAsync(CancellationToken ct = default)
    {
        const int maxCount = 2;

        _logger.LogInformation(
            "[MetricsCollectionService] 수집 배치 시작 (maxCount={MaxCount}, lastProcessedPostId={LastPostId})",
            maxCount,
            _lastProcessedPostId
        );

        var posts = await _socialPostRepository.GetPostsToCollectAsync(maxCount, _lastProcessedPostId, ct);

        if (posts.Count == 0)
        {
            _logger.LogInformation("[MetricsCollectionService] 수집 대상 social_post 가 없습니다. 커서 초기화.");
            _lastProcessedPostId = null; // 다음 배치에서 처음부터 다시 시작
            return;
        }

        foreach (var post in posts)
        {
            if (string.Equals(post.Platform, "youtube", StringComparison.OrdinalIgnoreCase))
            {
                var metrics = await _youTubeMetricsClient.GetMetricsAsync(post.PlatformPostId, ct);

                if (metrics is not null)
                {
                    var saveResult = await _metricsRepository.SaveMetricsAsync(post.PostId, metrics, ct);
                    if (saveResult)
                    {
                        _lastProcessedPostId = post.PostId; // 성공 시에만 커서 업데이트
                        _logger.LogInformation(
                            "[MetricsCollectionService] 메트릭 저장 완료 - post_id={PostId}, view={View}, like={Like}, comment={Comment}",
                            post.PostId,
                            metrics.ViewCount,
                            metrics.LikeCount,
                            metrics.CommentCount
                        );
                    }
                    else
                    {
                        _logger.LogWarning("[MetricsCollectionService] 메트릭 저장 실패 - post_id={PostId}", post.PostId);
                    }
                }
                else
                {
                    _logger.LogWarning(
                        "[MetricsCollectionService] YouTube 메트릭 조회 실패 - post_id={PostId}, videoId={VideoId}",
                        post.PostId,
                        post.PlatformPostId
                    );
                }
            }
            else if (string.Equals(post.Platform, "tiktok", StringComparison.OrdinalIgnoreCase))
            {
                // TODO: TikTok 메트릭 수집 로직 구현 예정
                _logger.LogInformation(
                    "[MetricsCollectionService] TikTok 메트릭 조회 (기본 틀) - post_id={PostId}, videoId={VideoId}",
                    post.PostId,
                    post.PlatformPostId
                );
                // 현재는 실행만 되도록 로그만 출력
            }
        }

        _logger.LogInformation(
            "[MetricsCollectionService] 수집 배치 완료 - 처리 건수: {Count}, 마지막 post_id: {LastPostId}",
            posts.Count,
            _lastProcessedPostId
        );
    }
}


