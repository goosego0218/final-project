namespace makery_metrics_service.Services.Social;

/// <summary>
/// TikTok 연동(social_connection) 정보를 조회할 때 사용하는 DTO 입니다.
/// </summary>
public record TikTokConnectionInfo(
    int ConnId,
    string EncryptedAccessToken,
    string? OpenId
);

/// <summary>
/// social_connection 테이블에서 TikTok 연동 정보를 조회하는 리포지토리 인터페이스입니다.
/// </summary>
public interface ISocialConnectionRepository
{
    /// <summary>
    /// conn_id 로 TikTok 연동 정보를 조회합니다. (삭제되지 않은 건만)
    /// </summary>
    Task<TikTokConnectionInfo?> GetTikTokConnectionAsync(
        int connId,
        CancellationToken ct = default
    );
}


