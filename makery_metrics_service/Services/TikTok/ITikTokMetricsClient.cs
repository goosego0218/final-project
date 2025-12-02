namespace makery_metrics_service.Services.TikTok;

/// <summary>
/// 단일 TikTok 영상의 주요 메트릭 정보를 담는 DTO.
/// </summary>
public record TikTokVideoMetrics(
    long ViewCount,
    long LikeCount,
    long CommentCount,
    long? ShareCount = null
);

/// <summary>
/// TikTok API 등에서 영상 메트릭을 조회하는 클라이언트 인터페이스.
/// </summary>
public interface ITikTokMetricsClient
{
    /// <summary>
    /// 주어진 TikTok videoId에 대한 조회수/좋아요/댓글 수 등의 메트릭을 조회합니다.
    /// </summary>
    /// <param name="videoId">TikTok 영상 ID</param>
    /// <param name="ct">작업 취소 토큰</param>
    /// <returns>조회된 메트릭 정보, 실패 시 null</returns>
    Task<TikTokVideoMetrics?> GetMetricsAsync(
        string videoId,
        CancellationToken ct = default
    );
}
