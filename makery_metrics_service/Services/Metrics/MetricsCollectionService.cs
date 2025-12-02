using makery_metrics_service.Services.Social;
using makery_metrics_service.Services.YouTube;

namespace makery_metrics_service.Services.Metrics;

/// <summary>
/// 메트릭 수집 상위 서비스의 기본 구현체입니다.
/// 지금 단계에서는
/// - ISocialPostRepository 를 통해 수집 대상 social_post 를 조회하고
/// - 그 결과를 로그로만 출력합니다.
/// 이후 단계에서 YouTube/TikTok API 호출 및 social_post_metric 저장 로직을 추가합니다.
/// </summary>
public class MetricsCollectionService : IMetricsCollectionService
{
    private readonly ILogger<MetricsCollectionService> _logger;
    private readonly ISocialPostRepository _socialPostRepository;
    private readonly IYouTubeMetricsClient _youTubeMetricsClient;

    public MetricsCollectionService(
        ILogger<MetricsCollectionService> logger,
        ISocialPostRepository socialPostRepository,
        IYouTubeMetricsClient youTubeMetricsClient
    )
    {
        _logger = logger;
        _socialPostRepository = socialPostRepository;
        _youTubeMetricsClient = youTubeMetricsClient;
    }

    public async Task RunOnceAsync(CancellationToken ct = default)
    {
        const int maxCount = 10;

        _logger.LogInformation("[MetricsCollectionService] 수집 배치 시작 (maxCount={MaxCount})", maxCount);

        var posts = await _socialPostRepository.GetPostsToCollectAsync(maxCount, ct);

        if (posts.Count == 0)
        {
            _logger.LogInformation("[MetricsCollectionService] 수집 대상 social_post 가 없습니다.");
            return;
        }

        foreach (var post in posts)
        {
            _logger.LogInformation(
                "[MetricsCollectionService] 대상 post - post_id={PostId}, platform={Platform}, platform_post_id={PlatformPostId}",
                post.PostId,
                post.Platform,
                post.PlatformPostId
            );

            // 1단계: YouTube 대상인 경우에만 메트릭 클라이언트 호출 (현재는 더미 구현)
            if (string.Equals(post.Platform, "youtube", StringComparison.OrdinalIgnoreCase))
            {
                var metrics = await _youTubeMetricsClient.GetMetricsAsync(post.PlatformPostId, ct);

                if (metrics is not null)
                {
                    _logger.LogInformation(
                        "[MetricsCollectionService] YouTube 메트릭 - post_id={PostId}, view={View}, like={Like}, comment={Comment}",
                        post.PostId,
                        metrics.ViewCount,
                        metrics.LikeCount,
                        metrics.CommentCount
                    );
                }
                else
                {
                    _logger.LogWarning(
                        "[MetricsCollectionService] YouTube 메트릭 조회 실패 또는 결과 없음 - post_id={PostId}, videoId={VideoId}",
                        post.PostId,
                        post.PlatformPostId
                    );
                }
            }
        }

        _logger.LogInformation("[MetricsCollectionService] 수집 대상 social_post {Count}건 조회 완료", posts.Count);
    }
}


