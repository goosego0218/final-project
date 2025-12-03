using makery_metrics_service.Services.Crypto;
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
    private readonly ISocialConnectionRepository _socialConnectionRepository;
    private readonly IConfiguration _config;

    // 커서 기반 페이징을 위한 마지막 처리된 post_id (Singleton이므로 메모리에 유지됨)
    private int? _lastProcessedPostId;

    public MetricsCollectionService(
        ILogger<MetricsCollectionService> logger,
        ISocialPostRepository socialPostRepository,
        IYouTubeMetricsClient youTubeMetricsClient,
        ITikTokMetricsClient tikTokMetricsClient,
        ISocialMetricsRepository metricsRepository,
        ISocialConnectionRepository socialConnectionRepository,
        IConfiguration config
    )
    {
        _logger = logger;
        _socialPostRepository = socialPostRepository;
        _youTubeMetricsClient = youTubeMetricsClient;
        _tikTokMetricsClient = tikTokMetricsClient;
        _metricsRepository = metricsRepository;
        _socialConnectionRepository = socialConnectionRepository;
        _config = config;
    }

    public async Task<int> RunOnceAsync(CancellationToken ct = default)
    {
        const int maxCount = 20; // 배치당 처리 건수 (TikTok API rate limit 고려)

        _logger.LogInformation(
            "[MetricsCollectionService] 수집 배치 시작 (maxCount={MaxCount}, lastProcessedPostId={LastPostId})",
            maxCount,
            _lastProcessedPostId
        );

        var posts = await _socialPostRepository.GetPostsToCollectAsync(maxCount, _lastProcessedPostId, ct);

        if (posts.Count == 0)
        {
            _logger.LogInformation("[MetricsCollectionService] 수집 대상 social_post 가 없습니다.");
            return 0; // 더 이상 처리할 데이터가 없음
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
                    // YouTube 메트릭 조회 실패 - 처리는 완료된 것으로 간주하고 커서 업데이트
                    _lastProcessedPostId = post.PostId;
                    _logger.LogWarning(
                        "[MetricsCollectionService] YouTube 메트릭 조회 실패 - post_id={PostId}, videoId={VideoId}. 처리 완료로 간주하고 다음으로 진행",
                        post.PostId,
                        post.PlatformPostId
                    );
                }
            }
            else if (string.Equals(post.Platform, "tiktok", StringComparison.OrdinalIgnoreCase))
            {
                // 1) TikTok 연동 정보 조회
                var conn = await _socialConnectionRepository.GetTikTokConnectionAsync(post.ConnId, ct);
                if (conn is null)
                {
                    _logger.LogWarning(
                        "[MetricsCollectionService] TikTok 연동 정보를 찾을 수 없음 - post_id={PostId}, conn_id={ConnId}",
                        post.PostId,
                        post.ConnId
                    );
                    continue;
                }

                // 2) 토큰 복호화
                var decryptKey = _config["Crypto:TokenDecryptKey"];
                if (string.IsNullOrWhiteSpace(decryptKey))
                {
                    _logger.LogError("[MetricsCollectionService] Crypto:TokenDecryptKey 설정이 없습니다.");
                    continue;
                }

                var accessToken = TokenCrypto.DecryptToken(conn.EncryptedAccessToken, decryptKey);
                if (string.IsNullOrWhiteSpace(accessToken))
                {
                    _logger.LogWarning(
                        "[MetricsCollectionService] TikTok access_token 복호화 실패 - post_id={PostId}, conn_id={ConnId}",
                        post.PostId,
                        post.ConnId
                    );
                    continue;
                }

                // 3) TikTok publish 상태 조회 호출 (DB에서 가져온 값을 그대로 publish_id 로 사용)
                var publishStatus = await _tikTokMetricsClient.FetchPublishStatusAsync(
                    publishId: post.PlatformPostId,
                    accessToken: accessToken,
                    ct: ct
                );

                var hasData = publishStatus?.Data is not null;
                var videoId = publishStatus?.Data?.PublicalyAvailablePostId.FirstOrDefault();

                _logger.LogInformation(
                    "[MetricsCollectionService] TikTok publish 상태 조회 완료 - post_id={PostId}, publish_id={PublishId}, hasData={HasData}, video_id={VideoId}",
                    post.PostId,
                    post.PlatformPostId,
                    hasData,
                    videoId ?? "(none)"
                );

                // 4) video_id 가 있으면 TikTok 메트릭 조회
                if (!string.IsNullOrWhiteSpace(videoId))
                {
                    var metrics = await _tikTokMetricsClient.GetMetricsAsync(
                        videoId: videoId,
                        accessToken: accessToken,
                        openId: conn.OpenId,
                        ct: ct
                    );

                    if (metrics is not null)
                    {
                        var saveResult = await _metricsRepository.SaveMetricsAsync(post.PostId, metrics, ct);
                        if (saveResult)
                        {
                            _lastProcessedPostId = post.PostId; // 성공 시에만 커서 업데이트
                            _logger.LogInformation(
                                "[MetricsCollectionService] TikTok 메트릭 저장 완료 - post_id={PostId}, video_id={VideoId}, view={View}, like={Like}, comment={Comment}, share={Share}",
                                post.PostId,
                                videoId,
                                metrics.ViewCount,
                                metrics.LikeCount,
                                metrics.CommentCount,
                                metrics.ShareCount
                            );
                        }
                        else
                        {
                            _logger.LogWarning("[MetricsCollectionService] TikTok 메트릭 저장 실패 - post_id={PostId}", post.PostId);
                        }
                    }
                    else
                    {
                        _logger.LogWarning(
                            "[MetricsCollectionService] TikTok 메트릭 조회 실패 - post_id={PostId}, video_id={VideoId}",
                            post.PostId,
                            videoId
                        );
                    }
                }
                else
                {
                    // video_id가 없는 경우 (비공개 영상 등) - 처리는 완료된 것으로 간주하고 커서 업데이트
                    _lastProcessedPostId = post.PostId;
                    _logger.LogInformation(
                        "[MetricsCollectionService] TikTok video_id 없음 (비공개 영상 등) - post_id={PostId}, publish_id={PublishId}. 처리 완료로 간주하고 다음으로 진행",
                        post.PostId,
                        post.PlatformPostId
                    );
                }
            }
        }

        _logger.LogInformation(
            "[MetricsCollectionService] 수집 배치 완료 - 처리 건수: {Count}, 마지막 post_id: {LastPostId}",
            posts.Count,
            _lastProcessedPostId
        );

        return posts.Count;
    }
}


