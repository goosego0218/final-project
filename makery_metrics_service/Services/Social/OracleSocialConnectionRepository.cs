namespace makery_metrics_service.Services.Social;

/// <summary>
/// Oracle DB 의 social_connection 테이블에서
/// TikTok 연동 정보를 조회하는 리포지토리 구현체입니다.
/// </summary>
public class OracleSocialConnectionRepository : ISocialConnectionRepository
{
    private readonly IConfiguration _config;
    private readonly ILogger<OracleSocialConnectionRepository> _logger;

    public OracleSocialConnectionRepository(
        IConfiguration config,
        ILogger<OracleSocialConnectionRepository> logger
    )
    {
        _config = config;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<TikTokConnectionInfo?> GetTikTokConnectionAsync(
        int connId,
        CancellationToken ct = default
    )
    {
        var connStr = _config.GetConnectionString("OracleDb");
        if (string.IsNullOrWhiteSpace(connStr))
        {
            _logger.LogError("[OracleSocialConnectionRepository] ConnectionStrings:OracleDb 가 비어 있습니다.");
            return null;
        }

        try
        {
            await using var conn = new OracleConnection(connStr);
            await conn.OpenAsync(ct);

            const string sql = @"
                SELECT conn_id, access_token, platform_user_id
                FROM social_connection
                WHERE conn_id = :connId
                  AND platform = 'tiktok'
                  AND del_yn = 'N'
            ";

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;

            var connIdParam = cmd.CreateParameter();
            connIdParam.ParameterName = "connId";
            connIdParam.Value = connId;
            cmd.Parameters.Add(connIdParam);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                var id = reader.GetInt32(0);
                var encryptedAccessToken = reader.IsDBNull(1) ? string.Empty : reader.GetString(1);
                var openId = reader.IsDBNull(2) ? null : reader.GetString(2);

                return new TikTokConnectionInfo(
                    ConnId: id,
                    EncryptedAccessToken: encryptedAccessToken,
                    OpenId: openId
                );
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[OracleSocialConnectionRepository] TikTok 연동 조회 중 오류 발생 - conn_id={ConnId}", connId);
            return null;
        }
    }
}
