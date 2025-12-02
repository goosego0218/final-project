using makery_metrics_service.Services.YouTube;

namespace makery_metrics_service.Services.Metrics;

/// <summary>
/// Oracle DB의 social_post_metric 테이블에 메트릭 데이터를 저장하는 리포지토리 구현체입니다.
/// </summary>
public class OracleSocialMetricsRepository : ISocialMetricsRepository
{
    private readonly IConfiguration _config;
    private readonly ILogger<OracleSocialMetricsRepository> _logger;

    public OracleSocialMetricsRepository(
        IConfiguration config,
        ILogger<OracleSocialMetricsRepository> logger
    )
    {
        _config = config;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<bool> SaveMetricsAsync(
        int postId,
        YouTubeVideoMetrics metrics,
        CancellationToken ct = default
    )
    {
        var connStr = _config.GetConnectionString("OracleDb");
        if (string.IsNullOrWhiteSpace(connStr))
        {
            _logger.LogError("[OracleSocialMetricsRepository] ConnectionStrings:OracleDb 가 비어 있습니다.");
            return false;
        }

        try
        {
            await using var conn = new OracleConnection(connStr);
            await conn.OpenAsync(ct);

            // metric_id는 시퀀스(trg_social_post_metric_bi)로 자동 생성
            // captured_at은 DEFAULT SYSDATE로 자동 설정
            const string sql = @"
                INSERT INTO social_post_metric (
                    post_id,
                    view_cnt,
                    like_cnt,
                    comment_cnt,
                    share_cnt
                ) VALUES (
                    :postId,
                    :viewCnt,
                    :likeCnt,
                    :commentCnt,
                    :shareCnt
                )
            ";

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;

            var postIdParam = cmd.CreateParameter();
            postIdParam.ParameterName = "postId";
            postIdParam.Value = postId;
            cmd.Parameters.Add(postIdParam);

            var viewCntParam = cmd.CreateParameter();
            viewCntParam.ParameterName = "viewCnt";
            viewCntParam.Value = metrics.ViewCount;
            cmd.Parameters.Add(viewCntParam);

            var likeCntParam = cmd.CreateParameter();
            likeCntParam.ParameterName = "likeCnt";
            likeCntParam.Value = metrics.LikeCount;
            cmd.Parameters.Add(likeCntParam);

            var commentCntParam = cmd.CreateParameter();
            commentCntParam.ParameterName = "commentCnt";
            commentCntParam.Value = metrics.CommentCount;
            cmd.Parameters.Add(commentCntParam);

            var shareCntParam = cmd.CreateParameter();
            shareCntParam.ParameterName = "shareCnt";
            shareCntParam.Value = metrics.ShareCount ?? (object)DBNull.Value;
            cmd.Parameters.Add(shareCntParam);

            var rowsAffected = await cmd.ExecuteNonQueryAsync(ct);

            if (rowsAffected > 0)
            {
                _logger.LogInformation(
                    "[OracleSocialMetricsRepository] 메트릭 저장 성공 - post_id={PostId}, view={View}, like={Like}, comment={Comment}",
                    postId,
                    metrics.ViewCount,
                    metrics.LikeCount,
                    metrics.CommentCount
                );
                return true;
            }
            else
            {
                _logger.LogWarning("[OracleSocialMetricsRepository] INSERT 결과 rowsAffected=0 - post_id={PostId}", postId);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "[OracleSocialMetricsRepository] 메트릭 저장 중 오류 발생 - post_id={PostId}",
                postId
            );
            return false;
        }
    }
}

