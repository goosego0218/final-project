# Makery Metrics Service

YouTube 및 TikTok 영상 메트릭을 수집하는 Windows Service입니다.

## 기능

- **YouTube 메트릭 수집**: YouTube Data API를 통해 조회수, 좋아요, 댓글 수 수집
- **TikTok 메트릭 수집**: TikTok Open API를 통해 조회수, 좋아요, 댓글 수, 공유 수 수집
- **자동 스케줄링**: 매일 지정된 시간에 자동으로 메트릭 수집 실행
- **배치 처리**: TikTok API rate limit을 고려하여 배치로 나눠서 처리

## 설정

### appsettings.json 생성

프로젝트 루트에 `appsettings.json` 파일을 생성하고 다음 내용을 작성하세요:

```json
{
  "ConnectionStrings": {
    "OracleDb": "Data Source=YOUR_DB_HOST:PORT/SERVICE_NAME;User Id=YOUR_USER_ID;Password=YOUR_PASSWORD;"
  },
  "Schedule": {
    "DailyRunTime": "00:00"
  },
  "YouTube": {
    "ApiKey": "YOUR_YOUTUBE_API_KEY",
    "BaseUrl": "https://www.googleapis.com/youtube/v3"
  },
  "TikTok": {
    "BaseUrl": "https://open.tiktokapis.com"
  },
  "Crypto": {
    "TokenDecryptKey": "YOUR_ENCRYPTION_KEY",
    "TokenSalt": "makery_encryption_salt"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  }
}
```

### 설정 항목 설명

#### ConnectionStrings:OracleDb
- Oracle 데이터베이스 연결 문자열
- 형식: `Data Source=HOST:PORT/SERVICE_NAME;User Id=USER_ID;Password=PASSWORD;`

#### Schedule:DailyRunTime
- 매일 메트릭 수집을 실행할 시간
- 형식: `"HH:mm"` (예: `"00:00"`, `"14:30"`)
- 기본값: `"00:00"` (자정)

#### YouTube:ApiKey
- YouTube Data API v3 API 키
- [Google Cloud Console](https://console.cloud.google.com/)에서 발급

#### YouTube:BaseUrl
- YouTube API 기본 URL
- 기본값: `"https://www.googleapis.com/youtube/v3"`

#### TikTok:BaseUrl
- TikTok Open API 기본 URL
- 기본값: `"https://open.tiktokapis.com"`

#### Crypto:TokenDecryptKey
- TikTok access_token 복호화에 사용하는 암호화 키
- backend의 `settings.encryption_key`와 동일한 값 사용

#### Crypto:TokenSalt
- 암호화에 사용하는 salt 값
- 기본값: `"makery_encryption_salt"` (변경하지 않음)

## 빌드 및 실행

### 개발 환경에서 실행

```bash
# 프로젝트 디렉토리로 이동
cd makery_metrics_service

# 빌드
dotnet build

# 실행
dotnet run
```

### Release 빌드

```bash
# Release 빌드
dotnet build -c Release

# 실행 파일 생성 (bin/Release/net10.0/)
dotnet publish -c Release -o ./publish
```

## Windows Service 설치

### 1. 관리자 권한으로 실행

PowerShell 또는 CMD를 **관리자 권한**으로 실행하세요.

### 2. 서비스 설치

`makery_metrics_service` 폴더에서 `install-service.bat` 실행:

```batch
install-service.bat
```

### 3. 서비스 확인

- **서비스 관리자**: `services.msc`에서 "Makery Metrics Service" 확인
- **명령어**: `sc.exe query MakeryMetricsService`

### 4. 서비스 제거

`uninstall-service.bat` 실행:

```batch
uninstall-service.bat
```

## 서비스 관리 명령어

### 서비스 시작
```batch
sc.exe start MakeryMetricsService
```

### 서비스 중지
```batch
sc.exe stop MakeryMetricsService
```

### 서비스 상태 확인
```batch
sc.exe query MakeryMetricsService
```

### 서비스 재시작
```batch
sc.exe stop MakeryMetricsService
sc.exe start MakeryMetricsService
```

## 로그 확인

서비스 로그는 Windows Event Log에 기록됩니다.

- **이벤트 뷰어**: `eventvwr.msc` → Windows 로그 → 애플리케이션
- **필터**: "Makery Metrics Service" 또는 "makery_metrics_service" 검색

## 동작 방식

1. **스케줄링**: 매일 `Schedule:DailyRunTime`에 지정된 시간에 실행
2. **배치 처리**: 
   - 한 번에 최대 20건씩 처리
   - 각 배치 사이에 60초 대기 (TikTok API rate limit 고려)
   - 더 이상 처리할 데이터가 없을 때까지 반복
3. **YouTube 처리**:
   - `social_post` 테이블에서 `platform = 'youtube'`인 게시물 조회
   - YouTube Data API로 메트릭 수집
   - `social_post_metric` 테이블에 저장
4. **TikTok 처리**:
   - `social_post` 테이블에서 `platform = 'tiktok'`인 게시물 조회
   - `publish_id`로 TikTok API 호출하여 `video_id` 획득
   - `video_id`로 메트릭 수집
   - `social_post_metric` 테이블에 저장

## 문제 해결

### 서비스가 시작되지 않음
- 관리자 권한으로 설치했는지 확인
- `appsettings.json` 파일이 올바른 위치에 있는지 확인
- 이벤트 뷰어에서 오류 로그 확인

### 메트릭이 수집되지 않음
- API 키가 올바른지 확인
- 데이터베이스 연결 문자열 확인
- `social_post` 테이블에 `status = 'SUCCESS'`인 데이터가 있는지 확인

### TikTok video_id가 없음
- 비공개 영상은 정상 동작 (video_id 없이 처리 완료로 간주)
- `publish_id`가 올바른지 확인

## 개발 환경

- .NET 10.0
- Oracle Database (Oracle.ManagedDataAccess.Core)
- Windows Service 지원

