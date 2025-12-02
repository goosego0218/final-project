using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace makery_metrics_service.Services.TikTok;

/// <summary>
/// TikTok 영상 메트릭을 조회하는 기본 클라이언트 구현체.
/// </summary>
public class TikTokMetricsClient : ITikTokMetricsClient
{
    private readonly IConfiguration _config;
    private readonly ILogger<TikTokMetricsClient> _logger;
    private readonly HttpClient _httpClient;

    public TikTokMetricsClient(
        IConfiguration config,
        ILogger<TikTokMetricsClient> logger
    )
    {
        _config = config;
        _logger = logger;
        _httpClient = new HttpClient();
    }

    /// <inheritdoc />
    public async Task<TikTokVideoMetrics?> GetMetricsAsync(
        string videoId,
        string accessToken,
        string? openId = null,
        CancellationToken ct = default
    )
    {
        if (string.IsNullOrWhiteSpace(videoId))
        {
            _logger.LogWarning("[TikTokMetricsClient] videoId 가 비어 있습니다.");
            return null;
        }

        if (string.IsNullOrWhiteSpace(accessToken))
        {
            _logger.LogWarning("[TikTokMetricsClient] accessToken 이 비어 있습니다.");
            return null;
        }

        var baseUrl = _config["TikTok:BaseUrl"] ?? "https://open.tiktokapis.com";

        // 공식 문서 기준: POST /v2/video/query/?fields=...
        // https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count
        var fields = "id,view_count,like_count,comment_count,share_count";
        var url = $"{baseUrl.TrimEnd('/')}/v2/video/query/?fields={Uri.EscapeDataString(fields)}";

        try
        {
            // body: { "filters": { "video_ids": [ "..." ] } }
            var payload = new
            {
                filters = new
                {
                    video_ids = new[] { videoId }
                }
            };

            var json = JsonSerializer.Serialize(payload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Content = content;

            using var response = await _httpClient.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "[TikTokMetricsClient] TikTok API 실패 - StatusCode={Status}",
                    response.StatusCode
                );
                return null;
            }

            // 2단계: JSON 파싱해서 TikTokVideoMetrics 로 변환
            try
            {
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                if (!root.TryGetProperty("data", out var dataElement))
                {
                    _logger.LogWarning("[TikTokMetricsClient] 응답에 data 필드가 없습니다.");
                    return null;
                }

                if (!dataElement.TryGetProperty("videos", out var videosElement) ||
                    videosElement.ValueKind != JsonValueKind.Array ||
                    videosElement.GetArrayLength() == 0)
                {
                    _logger.LogWarning("[TikTokMetricsClient] videos 배열이 비어 있거나 없습니다.");
                    return null;
                }

                var video = videosElement[0];

                long GetLong(string name)
                {
                    if (!video.TryGetProperty(name, out var p))
                        return 0;

                    if (p.ValueKind == JsonValueKind.Number && p.TryGetInt64(out var num))
                        return num;

                    if (p.ValueKind == JsonValueKind.String &&
                        long.TryParse(p.GetString(), out var parsed))
                        return parsed;

                    return 0;
                }

                var viewCount = GetLong("view_count");
                var likeCount = GetLong("like_count");
                var commentCount = GetLong("comment_count");
                var shareCount = GetLong("share_count");

                return new TikTokVideoMetrics(
                    ViewCount: viewCount,
                    LikeCount: likeCount,
                    CommentCount: commentCount,
                    ShareCount: shareCount
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TikTokMetricsClient] 응답 JSON 파싱 중 예외 발생 (videoId={VideoId})", videoId);
                return null;
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("[TikTokMetricsClient] 호출 취소됨 (videoId={VideoId})", videoId);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TikTokMetricsClient] TikTok API 호출 중 예외 발생 (videoId={VideoId})", videoId);
            return null;
        }
    }

    /// <inheritdoc />
    public async Task<TikTokPublishStatusResponse?> FetchPublishStatusAsync(
        string publishId,
        string accessToken,
        CancellationToken ct = default
    )
    {
        if (string.IsNullOrWhiteSpace(publishId))
        {
            _logger.LogWarning("[TikTokMetricsClient] publishId 가 비어 있습니다.");
            return null;
        }

        if (string.IsNullOrWhiteSpace(accessToken))
        {
            _logger.LogWarning("[TikTokMetricsClient] accessToken 이 비어 있습니다. (publishId={PublishId})", publishId);
            return null;
        }

        var baseUrl = _config["TikTok:BaseUrl"] ?? "https://open.tiktokapis.com";
        var url = $"{baseUrl.TrimEnd('/')}/v2/post/publish/status/fetch/";

        try
        {
            var payload = new
            {
                publish_id = publishId
            };

            var json = JsonSerializer.Serialize(payload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Content = content;

            using var response = await _httpClient.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "[TikTokMetricsClient] publish 상태 조회 실패 - StatusCode={Status}, publish_id={PublishId}",
                    response.StatusCode,
                    publishId
                );
                return null;
            }

            try
            {
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                // error 블록
                string errorCode = "unknown";
                string errorMessage = string.Empty;
                string? logId = null;

                if (root.TryGetProperty("error", out var errorElement))
                {
                    if (errorElement.TryGetProperty("code", out var codeEl) &&
                        codeEl.ValueKind == JsonValueKind.String)
                    {
                        errorCode = codeEl.GetString() ?? "unknown";
                    }

                    if (errorElement.TryGetProperty("message", out var msgEl) &&
                        msgEl.ValueKind == JsonValueKind.String)
                    {
                        errorMessage = msgEl.GetString() ?? string.Empty;
                    }

                    if (errorElement.TryGetProperty("log_id", out var logEl) &&
                        logEl.ValueKind == JsonValueKind.String)
                    {
                        logId = logEl.GetString();
                    }
                }

                TikTokPublishStatusData? data = null;

                if (root.TryGetProperty("data", out var dataElement) &&
                    dataElement.ValueKind == JsonValueKind.Object)
                {
                    var status = dataElement.TryGetProperty("status", out var statusEl) &&
                                 statusEl.ValueKind == JsonValueKind.String
                        ? statusEl.GetString() ?? string.Empty
                        : string.Empty;

                    var failReason = dataElement.TryGetProperty("fail_reason", out var failEl) &&
                                     failEl.ValueKind == JsonValueKind.String
                        ? failEl.GetString() ?? string.Empty
                        : string.Empty;

                    long uploadedBytes = 0;
                    if (dataElement.TryGetProperty("uploaded_bytes", out var uploadedEl))
                    {
                        if (uploadedEl.ValueKind == JsonValueKind.Number &&
                            uploadedEl.TryGetInt64(out var num))
                        {
                            uploadedBytes = num;
                        }
                        else if (uploadedEl.ValueKind == JsonValueKind.String &&
                                 long.TryParse(uploadedEl.GetString(), out var parsed))
                        {
                            uploadedBytes = parsed;
                        }
                    }

                    var ids = new List<string>();
                    if (dataElement.TryGetProperty("publicaly_available_post_id", out var idsEl) &&
                        idsEl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in idsEl.EnumerateArray())
                        {
                            string? v = null;

                            if (item.ValueKind == JsonValueKind.String)
                            {
                                v = item.GetString();
                            }
                            else if (item.ValueKind == JsonValueKind.Number &&
                                     item.TryGetInt64(out var numId))
                            {
                                v = numId.ToString();
                            }

                            if (!string.IsNullOrEmpty(v))
                            {
                                ids.Add(v);
                            }
                        }
                    }

                    data = new TikTokPublishStatusData(
                        Status: status,
                        FailReason: failReason,
                        PublicalyAvailablePostId: ids,
                        UploadedBytes: uploadedBytes
                    );
                }

                if (data is not null)
                {
                    var firstPostId = data.PublicalyAvailablePostId.FirstOrDefault() ?? "(none)";
                    _logger.LogInformation(
                        "[TikTokMetricsClient] publish 상태 파싱 성공 - publish_id={PublishId}, status={Status}, fail_reason={FailReason}, first_post_id={PostId}, uploaded_bytes={UploadedBytes}, error_code={ErrorCode}, error_message={ErrorMessage}",
                        publishId,
                        data.Status,
                        data.FailReason,
                        firstPostId,
                        data.UploadedBytes,
                        errorCode,
                        errorMessage
                    );
                }

                return new TikTokPublishStatusResponse(
                    Data: data,
                    ErrorCode: errorCode,
                    ErrorMessage: errorMessage,
                    LogId: logId
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "[TikTokMetricsClient] publish 상태 응답 JSON 파싱 중 예외 발생 (publish_id={PublishId})",
                    publishId
                );
                return null;
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("[TikTokMetricsClient] publish 상태 조회 호출 취소됨 (publish_id={PublishId})", publishId);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TikTokMetricsClient] publish 상태 조회 중 예외 발생 (publish_id={PublishId})", publishId);
            return null;
        }
    }
}
