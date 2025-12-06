using makery_metrics_service.Services;

namespace makery_metrics_service.Services.Metrics;

/// <summary>
/// social_post 에 대해 메트릭을 수집하고 결과를 저장하는
/// 상위 비즈니스 로직 서비스의 인터페이스입니다.
/// 지금 단계에서는 단순히 대상 post 목록을 조회하고
/// 로그로 출력하는 정도만 담당합니다.
/// </summary>
public interface IMetricsCollectionService
{
    /// <summary>
    /// 한 번의 배치를 수행합니다.
    /// (예: social_post 몇 건을 읽어서, 이후 단계에서 메트릭을 수집/저장)
    /// </summary>
    /// <param name="ct">작업 취소 토큰</param>
    /// <returns>처리한 post 건수 (0이면 더 이상 처리할 데이터가 없음)</returns>
    Task<int> RunOnceAsync(CancellationToken ct = default);
}


