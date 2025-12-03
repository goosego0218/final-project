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
/// TikTok 게시물 퍼블리시 상태 조회 응답 data 영역 DTO.
/// </summary>
public record TikTokPublishStatusData(
    string Status,
    string FailReason,
    IReadOnlyList<string> PublicalyAvailablePostId,
    long UploadedBytes
);

/// <summary>
/// TikTok 게시물 퍼블리시 상태 조회 전체 응답 DTO.
/// </summary>
public record TikTokPublishStatusResponse(
    TikTokPublishStatusData? Data,
    string ErrorCode,
    string ErrorMessage,
    string? LogId
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
    /// <param name="accessToken">복호화된 TikTok access_token</param>
    /// <param name="openId">연동 계정의 open_id (필요 없으면 null)</param>
    /// <param name="ct">작업 취소 토큰</param>
    /// <returns>조회된 메트릭 정보, 실패 시 null</returns>
    Task<TikTokVideoMetrics?> GetMetricsAsync(
        string videoId,
        string accessToken,
        string? openId = null,
        CancellationToken ct = default
    );

    /// <summary>
    /// DB 등에서 조회한 publish_id 를 이용해 TikTok 퍼블리시 상태를 조회합니다.
    /// </summary>
    /// <param name="publishId">TikTok 에서 발급한 publish_id</param>
    /// <param name="accessToken">복호화된 TikTok access_token</param>
    /// <param name="ct">작업 취소 토큰</param>
    /// <returns>퍼블리시 상태 응답, 호출/파싱 실패 시 null</returns>
    Task<TikTokPublishStatusResponse?> FetchPublishStatusAsync(
        string publishId,
        string accessToken,
        CancellationToken ct = default
    );
}
