namespace makery_metrics_service.Services.YouTube;

/// <summary>
/// 단일 유튜브 영상의 주요 메트릭 정보를 담는 DTO.
/// </summary>
public record YouTubeVideoMetrics(
    long ViewCount,
    long LikeCount,
    long CommentCount,
    long? ShareCount = null // 필요 없으면 빼도 됨
);

/// <summary>
/// YouTube API 등에서 영상 메트릭을 조회하는 클라이언트 인터페이스.
/// </summary>
public interface IYouTubeMetricsClient
{
    /// <summary>
    /// 주어진 YouTube videoId에 대한 조회수/좋아요/댓글 수 등의 메트릭을 조회합니다.
    /// </summary>
    Task<YouTubeVideoMetrics?> GetMetricsAsync(
        string videoId, 
        CancellationToken ct = default //취소 토큰(CancellationToken) 은 “서비스가 종료되라고 신호를 보낼 때, 현재 진행 중인 비동기 작업을 깔끔하게 멈추도록 전달하는 통로”다.
    );
}
