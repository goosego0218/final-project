namespace makery_metrics_service.Services.Social;

/// <summary>
/// social_post 테이블에서 수집 대상 게시물을 읽어올 때 사용하는
/// 최소한의 정보를 담는 DTO 입니다.
/// </summary>
public record SocialPostRecord(
    int PostId,
    string Platform,
    string PlatformPostId
);

/// <summary>
/// 수집 대상 social_post 를 조회하는 리포지토리 인터페이스입니다.
/// </summary>
public interface ISocialPostRepository
{
    /// <summary>
    /// 메트릭 수집 대상이 되는 social_post 목록을 조회합니다.
    /// (예: status='SUCCESS', del_yn='N', 연동 계정이 살아있는 건 등)
    /// </summary>
    /// <param name="maxCount">최대 조회 개수 (예: 10)</param>
    /// <param name="ct">작업 취소 토큰</param>
    /// <returns>수집 대상 게시물 목록</returns>
    Task<IReadOnlyList<SocialPostRecord>> GetPostsToCollectAsync(
        int maxCount,
        CancellationToken ct = default
    );
}


