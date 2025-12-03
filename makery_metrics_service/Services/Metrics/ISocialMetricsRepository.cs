using makery_metrics_service.Services.TikTok;
using makery_metrics_service.Services.YouTube;

namespace makery_metrics_service.Services.Metrics;

/// <summary>
/// social_post_metric 테이블에 메트릭 데이터를 저장하는 리포지토리 인터페이스입니다.
/// </summary>
public interface ISocialMetricsRepository
{
    /// <summary>
    /// 주어진 post_id에 대한 YouTube 메트릭 정보를 social_post_metric 테이블에 INSERT 합니다.
    /// </summary>
    /// <param name="postId">social_post.post_id</param>
    /// <param name="metrics">수집된 메트릭 정보 (조회수, 좋아요, 댓글 수 등)</param>
    /// <param name="ct">작업 취소 토큰</param>
    /// <returns>성공 시 true, 실패 시 false</returns>
    Task<bool> SaveMetricsAsync(
        int postId,
        YouTubeVideoMetrics metrics,
        CancellationToken ct = default
    );

    /// <summary>
    /// 주어진 post_id에 대한 TikTok 메트릭 정보를 social_post_metric 테이블에 INSERT 합니다.
    /// </summary>
    /// <param name="postId">social_post.post_id</param>
    /// <param name="metrics">수집된 메트릭 정보 (조회수, 좋아요, 댓글 수 등)</param>
    /// <param name="ct">작업 취소 토큰</param>
    /// <returns>성공 시 true, 실패 시 false</returns>
    Task<bool> SaveMetricsAsync(
        int postId,
        TikTokVideoMetrics metrics,
        CancellationToken ct = default
    );
}

