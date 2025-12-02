using System.Collections.Generic;

namespace makery_metrics_service.Services.Social;

/// <summary>
/// Oracle DB의 social_post / social_connection 테이블에서
/// 메트릭 수집 대상 게시물 목록을 조회하는 리포지토리 구현체입니다.
/// </summary>
public class OracleSocialPostRepository : ISocialPostRepository
{
    private readonly IConfiguration _config;
    private readonly ILogger<OracleSocialPostRepository> _logger;

    public OracleSocialPostRepository(
        IConfiguration config,
        ILogger<OracleSocialPostRepository> logger
    )
    {
        _config = config;
        _logger = logger;
    }

    public async Task<IReadOnlyList<SocialPostRecord>> GetPostsToCollectAsync(
        int maxCount,
        int? lastProcessedPostId = null,
        CancellationToken ct = default
    )
    {
        var connStr = _config.GetConnectionString("OracleDb");
        if (string.IsNullOrWhiteSpace(connStr))
        {
            _logger.LogError("[OracleSocialPostRepository] ConnectionStrings:OracleDb 가 비어 있습니다.");
            return Array.Empty<SocialPostRecord>();
        }

        var results = new List<SocialPostRecord>();

        try
        {
            await using var conn = new OracleConnection(connStr);
            await conn.OpenAsync(ct);

            const string sql = @"
                SELECT post_id, platform, platform_post_id
                FROM (
                    SELECT p.post_id, p.platform, p.platform_post_id
                    FROM social_post p
                    JOIN social_connection c
                      ON p.conn_id = c.conn_id
                    JOIN generation_prod gp
                      ON p.prod_id = gp.prod_id
                    JOIN prod_grp pg
                      ON gp.grp_id = pg.grp_id
                    WHERE p.status = 'SUCCESS'
                      AND p.platform_post_id IS NOT NULL
                      AND p.del_yn = 'N'
                      AND c.del_yn = 'N'
                      AND gp.del_yn = 'N'
                      AND pg.del_yn = 'N'
                      AND ( :hasCursor = 0 OR p.post_id > :cursorPostId )
                    ORDER BY p.post_id
                )
                WHERE ROWNUM <= :maxRows
            ";

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;

            // 커서 여부 (0: 전체, 1: lastProcessedPostId 이후만)
            var hasCursorParam = cmd.CreateParameter();
            hasCursorParam.ParameterName = "hasCursor";
            hasCursorParam.OracleDbType = OracleDbType.Int32;
            hasCursorParam.Value = lastProcessedPostId.HasValue ? 1 : 0;
            cmd.Parameters.Add(hasCursorParam);

            var cursorPostIdParam = cmd.CreateParameter();
            cursorPostIdParam.ParameterName = "cursorPostId";
            cursorPostIdParam.OracleDbType = OracleDbType.Int32;
            cursorPostIdParam.Value = lastProcessedPostId ?? 0;
            cmd.Parameters.Add(cursorPostIdParam);

            var maxRowsParam = cmd.CreateParameter();
            maxRowsParam.ParameterName = "maxRows";
            maxRowsParam.OracleDbType = OracleDbType.Int32;
            maxRowsParam.Value = maxCount;
            cmd.Parameters.Add(maxRowsParam);

            await using var reader = await cmd.ExecuteReaderAsync(ct);

            while (await reader.ReadAsync(ct))
            {
                var postId = reader.GetInt32(0);
                var platform = reader.GetString(1);
                var platformPostId = reader.GetString(2);

                results.Add(new SocialPostRecord(
                    PostId: postId,
                    Platform: platform,
                    PlatformPostId: platformPostId
                ));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[OracleSocialPostRepository] social_post 조회 중 오류 발생");
            return Array.Empty<SocialPostRecord>();
        }

        return results;
    }
}


