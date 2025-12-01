using System.Net.Http;
using System.Text.Json;

namespace makery_metrics_service.Services.YouTube;

/// <summary>
/// YouTube 영상 메트릭을 조회하는 기본 클라이언트 구현체.
/// YouTube Data API v3 의 videos.list(statistics) 엔드포인트를 호출합니다.
/// </summary>
public class YouTubeMetricsClient : IYouTubeMetricsClient
{
    private readonly IConfiguration _config;
    private readonly ILogger<YouTubeMetricsClient> _logger;
    private readonly HttpClient _httpClient = new();

    public YouTubeMetricsClient(
        IConfiguration config,
        ILogger<YouTubeMetricsClient> logger
    )
    {
        _config = config;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<YouTubeVideoMetrics?> GetMetricsAsync(
        string videoId,
        CancellationToken ct = default
    )
    {
        var apiKey = _config["YouTube:ApiKey"];
        var baseUrl = _config["YouTube:BaseUrl"] ?? "https://www.googleapis.com/youtube/v3";

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogError("[YouTubeMetricsClient] YouTube:ApiKey 설정이 없습니다.");
            return null;
        }

        if (string.IsNullOrWhiteSpace(videoId))
        {
            _logger.LogWarning("[YouTubeMetricsClient] videoId 가 비어 있습니다.");
            return null;
        }

        var url = $"{baseUrl.TrimEnd('/')}/videos?part=statistics&id={videoId}&key={apiKey}";
        _logger.LogInformation("[YouTubeMetricsClient] YouTube API 호출 - {Url}", url);

        try
        {
            using var response = await _httpClient.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning(
                    "[YouTubeMetricsClient] API 실패 - StatusCode={Status}, Body={Body}",
                    response.StatusCode,
                    errorBody
                );
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var root = doc.RootElement;

            if (!root.TryGetProperty("items", out var items) || items.GetArrayLength() == 0)
            {
                _logger.LogWarning("[YouTubeMetricsClient] items 비어 있음 (videoId={VideoId})", videoId);
                return null;
            }

            var stats = items[0].GetProperty("statistics");

            long GetLong(string name)
            {
                if (!stats.TryGetProperty(name, out var p))
                    return 0;

                // 숫자 타입인 경우
                if (p.ValueKind == JsonValueKind.Number && p.TryGetInt64(out var num))
                    return num;

                // 문자열 타입인 경우 ("12345" 형태)
                if (p.ValueKind == JsonValueKind.String)
                {
                    var s = p.GetString();
                    if (long.TryParse(s, out var parsed))
                        return parsed;
                }

                return 0;
            }

            var viewCount = GetLong("viewCount");
            var likeCount = GetLong("likeCount");
            var commentCount = GetLong("commentCount");

            _logger.LogInformation(
                "[YouTubeMetricsClient] 조회 성공 - videoId={VideoId}, view={View}, like={Like}, comment={Comment}",
                videoId, viewCount, likeCount, commentCount
            );

            return new YouTubeVideoMetrics(
                ViewCount: viewCount,
                LikeCount: likeCount,
                CommentCount: commentCount
            );
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("[YouTubeMetricsClient] 호출 취소됨 (videoId={VideoId})", videoId);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[YouTubeMetricsClient] API 호출 중 예외 발생 (videoId={VideoId})", videoId);
            return null;
        }
    }
}
