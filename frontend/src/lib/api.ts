// API base URL 설정
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const FILE_SERVER_URL = import.meta.env.VITE_FILE_SERVER_URL || 'https://kr.object.ncloudstorage.com/aissemble';

// 메뉴 타입 정의
export interface Menu {
  menu_id: number;
  menu_nm: string;
  up_menu_id: number | null;
  menu_path: string;
  menu_order: number | null;
  del_yn: string;
}

// 인증 관련 타입 정의
export interface UserBase {
  id: number;
  login_id: string;
  nickname: string;
  status: string;
  role_id: number;
}

export interface SignUpRequest {
  login_id: string;
  password: string;
  nickname: string;
  role_id?: number;
}

export interface LoginRequest {
  login_id: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// API 호출 헬퍼 함수
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options?.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // 401 Unauthorized 에러 발생 시 자동 로그아웃 처리
    if (response.status === 401) {
      // 로그인 상태 초기화
      localStorage.removeItem('isLoggedIn');
      sessionStorage.removeItem('isLoggedIn');
      localStorage.removeItem('accessToken');
      sessionStorage.removeItem('accessToken');
      localStorage.removeItem('userProfile');
      
      // 프로필 업데이트 이벤트 발생 (다른 컴포넌트에서 감지)
      window.dispatchEvent(new Event('profileUpdated'));
      window.dispatchEvent(new Event('logout'));
      
      // 로그인 페이지로 리다이렉트 (현재 페이지가 로그인이 필요한 페이지인 경우)
      if (window.location.pathname !== '/' && !window.location.pathname.includes('/logo-gallery') && !window.location.pathname.includes('/shortform-gallery')) {
        window.location.href = '/';
      }
    }
    
    const errorText = await response.text();
    let errorMessage = `API request failed: ${response.statusText}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorMessage;
    } catch {
      // JSON 파싱 실패 시 원본 텍스트 사용
      if (errorText) {
        errorMessage = errorText;
      }
    }
    
    throw new Error(errorMessage);
  }

  // 204 No Content 응답은 본문이 없으므로 JSON 파싱을 건너뜀
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// 메뉴 목록 조회
export async function getMenus(): Promise<Menu[]> {
  return apiRequest<Menu[]>('/menus', { method: 'GET' });
}

// 회원가입
export async function signUp(data: SignUpRequest): Promise<UserBase> {
  return apiRequest<UserBase>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 로그인
export async function login(data: LoginRequest): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 프로젝트 관련 타입 정의
export interface ProjectListItem {
  grp_id: number;
  grp_nm: string;
  grp_desc: string | null;
  creator_id: number;
  logo_count: number;
  shortform_count: number;
}

export interface CreateProjectRequest {
  grp_nm: string;
  grp_desc?: string | null;
}

export interface ProjectGrp {
  grp_id: number;
  grp_nm: string;
  grp_desc: string | null;
  creator_id: number;
}

// 프로젝트 목록 조회
export async function getProjects(): Promise<ProjectListItem[]> {
  return apiRequest<ProjectListItem[]>('/projects/groups', { method: 'GET' });
}

// 프로젝트 생성
export async function createProject(data: CreateProjectRequest): Promise<ProjectGrp> {
  return apiRequest<ProjectGrp>('/projects/groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}


// 브랜드 챗 관련 타입 정의
export interface BrandChatRequest {
  message: string;
  brand_session_id?: string;
  grp_nm?: string;
  grp_desc?: string;
}

export interface BrandInfo {
  brand_name?: string;
  category?: string;
  tone_mood?: string;
  core_keywords?: string;
  slogan?: string;
  target_age?: string;
  target_gender?: string;
  avoided_trends?: string;
  preferred_colors?: string;
}

export interface BrandChatResponse {
  reply: string;
  project_id?: number;
  brand_session_id?: string;
  brand_info?: BrandInfo;
}

// 브랜드 챗 API 호출
export async function sendBrandChat(data: BrandChatRequest): Promise<BrandChatResponse> {
  return apiRequest<BrandChatResponse>('/brand/chat', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 브랜드 프로젝트 생성
export interface CreateBrandProjectRequest {
  brand_session_id: string;
  grp_nm?: string;
  grp_desc?: string;
}

export interface CreateBrandProjectResponse {
  project_id: number;
  grp_nm: string;
  grp_desc?: string | null;
}

export async function createBrandProject(data: CreateBrandProjectRequest): Promise<CreateBrandProjectResponse> {
  return apiRequest<CreateBrandProjectResponse>('/brand/create-project', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 숏폼 챗 관련 인터페이스
export interface ShortsChatRequest {
  project_id: number;
  message?: string;
  shorts_session_id?: string;
}

export interface ShortsChatResponse {
  reply: string;
  project_id: number;
  shorts_session_id: string;
}

// 숏폼 intro API 호출 (브랜드 요약 정보)
export async function getShortsIntro(data: ShortsChatRequest): Promise<ShortsChatResponse> {
  return apiRequest<ShortsChatResponse>('/shorts/intro', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 로고 챗봇 관련 API
export interface LogoChatRequest {
  project_id: number;
  message?: string;
  logo_session_id?: string;
}

export interface LogoChatResponse {
  reply: string;
  project_id: number;
  logo_session_id: string;
}

// 로고 intro API 호출 (브랜드 요약 정보)
export async function getLogoIntro(data: LogoChatRequest): Promise<LogoChatResponse> {
  return apiRequest<LogoChatResponse>('/logo/intro', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 로고 챗봇 API 호출
export async function sendLogoChat(data: LogoChatRequest): Promise<LogoChatResponse> {
  return apiRequest<LogoChatResponse>('/logo/chat', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 숏폼 챗봇 API 호출
export async function sendShortsChat(data: ShortsChatRequest): Promise<ShortsChatResponse> {
  return apiRequest<ShortsChatResponse>('/shorts/chat', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 프로젝트 상세 조회 (브랜드 정보 포함)
export interface ProjectDetail {
  grp_id: number;
  grp_nm: string;
  grp_desc: string | null;
  creator_id: number;
  // 브랜드 정보가 있으면 포함
  brand_info?: BrandInfo;
}

export async function getProjectDetail(projectId: number): Promise<ProjectDetail> {
  return apiRequest<ProjectDetail>(`/projects/groups/${projectId}`, {
    method: 'GET',
  });
}

// 프로젝트 삭제
export async function deleteProject(projectId: number): Promise<void> {
  return apiRequest<void>(`/projects/groups/${projectId}`, {
    method: 'DELETE',
  });
}

// 프로젝트 수정
export interface UpdateProjectRequest {
  grp_nm: string;
  grp_desc?: string | null;
}

export async function updateProject(
  projectId: number,
  data: UpdateProjectRequest
): Promise<ProjectDetail> {
  return apiRequest<ProjectDetail>(`/projects/groups/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * 파일 경로를 완전한 파일 서버 URL로 변환합니다.
 * @param filePath 상대 경로 (예: "/media/logo/edited_output.png") 또는 완전한 URL
 * @returns 완전한 URL
 */
export function getFileUrl(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null;
  }
  
  // 이미 완전한 URL인 경우 그대로 반환
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  
  // 상대 경로인 경우 파일 서버 URL과 결합
  const baseUrl = FILE_SERVER_URL.replace(/\/$/, ""); // 끝의 슬래시 제거
  const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `${baseUrl}${path}`;
}

// YouTube 연동 관련 API
export interface YouTubeAuthUrlResponse {
  auth_url: string;
  state: string;
}

export interface YouTubeConnectionStatus {
  connected: boolean;
  email: string | null;
  platform_user_id: string | null;
  connected_at: string | null;
}

// YouTube OAuth 인증 URL 가져오기
export async function getYouTubeAuthUrl(): Promise<YouTubeAuthUrlResponse> {
  return apiRequest<YouTubeAuthUrlResponse>('/social/youtube/auth-url', {
    method: 'GET',
  });
}

// YouTube 연동 상태 조회
export async function getYouTubeConnectionStatus(): Promise<YouTubeConnectionStatus> {
  return apiRequest<YouTubeConnectionStatus>('/social/youtube/status', {
    method: 'GET',
  });
}

// YouTube 연동 해제
export async function disconnectYouTube(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/social/youtube/disconnect', {
    method: 'DELETE',
  });
}

// YouTube 업로드 관련 인터페이스
export interface YouTubeUploadRequest {
  video_url: string;
  title: string;
  project_id: number;  // 프로젝트 ID (브랜드 프로필 가져오기 위해)
  description?: string;  // 사용 안 함 (백엔드에서 자동 생성)
  tags?: string[];
  privacy?: 'public' | 'private' | 'unlisted';
}

export interface YouTubeUploadResponse {
  success: boolean;
  video_id: string;
  video_url: string;
  shorts_url: string;
  message: string;
}

// YouTube에 비디오 업로드
export async function uploadToYouTube(data: YouTubeUploadRequest): Promise<YouTubeUploadResponse> {
  return apiRequest<YouTubeUploadResponse>('/social/youtube/upload', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Instagram 업로드 관련 인터페이스
export interface InstagramUploadRequest {
  video_url: string;
  caption: string;
  project_id: number;
  share_to_feed?: boolean;
}

export interface InstagramUploadResponse {
  success: boolean;
  media_id: string;
  message: string;
}

// Instagram에 릴스 업로드
export async function uploadToInstagram(data: InstagramUploadRequest): Promise<InstagramUploadResponse> {
  return apiRequest<InstagramUploadResponse>('/social/instagram/upload', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 쇼츠 저장 API 호출
export async function saveShorts(data: SaveShortsRequest): Promise<SaveShortsResponse> {
  return apiRequest<SaveShortsResponse>('/shorts/save', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 쇼츠 저장 관련 인터페이스
export interface SaveShortsRequest {
  base64_video: string;
  project_id: number;
  prod_type_id?: number;
}

export interface SaveShortsResponse {
  success: boolean;
  message: string;
  prod_id: number;
  file_path: string;
  file_url: string;
}

// 쇼츠 목록 조회 인터페이스
export interface ShortsListItem {
  prod_id: number;
  file_path: string;
  file_url: string;
  create_dt: string | null;
}

// 쇼츠 목록 조회 API 호출
export async function getShortsList(projectId: number): Promise<ShortsListItem[]> {
  return apiRequest<ShortsListItem[]>(`/shorts/list?project_id=${projectId}`, {
    method: 'GET',
  });
}

// 로고 저장 관련 인터페이스
export interface SaveLogoRequest {
  base64_image: string;
  project_id: number;
  prod_type_id?: number;
}

export interface SaveLogoResponse {
  success: boolean;
  message: string;
  prod_id: number;
  file_path: string;
  file_url: string;
}

// 로고 목록 조회 인터페이스
export interface LogoListItem {
  prod_id: number;
  file_path: string;
  file_url: string;
  create_dt: string | null;
}

// 로고 저장 API 호출
export async function saveLogo(data: SaveLogoRequest): Promise<SaveLogoResponse> {
  return apiRequest<SaveLogoResponse>('/logo/save', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 로고 목록 조회 API 호출
export async function getLogoList(projectId: number): Promise<LogoListItem[]> {
  return apiRequest<LogoListItem[]>(`/logo/list?project_id=${projectId}`, {
    method: 'GET',
  });
}

// 로고 삭제 API 호출
export interface DeleteLogoResponse {
  success: boolean;
  message: string;
}

export async function deleteLogo(prodId: number): Promise<DeleteLogoResponse> {
  return apiRequest<DeleteLogoResponse>(`/logo/${prodId}`, {
    method: 'DELETE',
  });
}

// 갤러리 관련 인터페이스
export type SortOption = "latest" | "oldest" | "likes" | "comments";

export interface GalleryItem {
  prod_id: number;
  file_url: string;
  like_count: number;
  comment_count: number;
  create_dt: string;
  brand_name?: string | null;
  tags?: string[] | null;
}

export interface GalleryListResponse {
  items: GalleryItem[];
  total_count: number;
  skip: number;
  limit: number;
}

// 로고 갤러리 조회
export async function getLogoGallery(
  sortBy: SortOption = "latest",
  skip: number = 0,
  limit: number = 100,
  searchQuery?: string
): Promise<GalleryListResponse> {
  const params = new URLSearchParams({
    sort_by: sortBy,
    skip: skip.toString(),
    limit: limit.toString(),
  });
  if (searchQuery) {
    params.append("search_query", searchQuery);
  }
  return apiRequest<GalleryListResponse>(`/gallery/logos?${params.toString()}`, {
    method: 'GET',
  });
}

// 쇼츠 갤러리 조회
export async function getShortsGallery(
  sortBy: SortOption = "latest",
  skip: number = 0,
  limit: number = 100,
  searchQuery?: string
): Promise<GalleryListResponse> {
  const params = new URLSearchParams({
    sort_by: sortBy,
    skip: skip.toString(),
    limit: limit.toString(),
  });
  if (searchQuery) {
    params.append("search_query", searchQuery);
  }
  return apiRequest<GalleryListResponse>(`/gallery/shorts?${params.toString()}`, {
    method: 'GET',
  });
}

// 댓글 관련 인터페이스
export interface Comment {
  comment_id: number;
  prod_id: number;
  user_id: number;
  user_nickname: string;
  content: string;
  create_dt: string;
  update_dt: string;
}

export interface CommentListResponse {
  comments: Comment[];
  total_count: number;
}

export interface CreateCommentRequest {
  prod_id: number;
  content: string;
}

// 댓글 목록 조회
export async function getComments(prodId: number): Promise<CommentListResponse> {
  return apiRequest<CommentListResponse>(`/comments?prod_id=${prodId}`, {
    method: 'GET',
  });
}

// 댓글 작성
export async function createComment(data: CreateCommentRequest): Promise<Comment> {
  return apiRequest<Comment>('/comments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 댓글 삭제
export async function deleteComment(commentId: number): Promise<void> {
  return apiRequest<void>(`/comments/${commentId}`, {
    method: 'DELETE',
  });
}

// 좋아요 관련 인터페이스
export interface LikeToggleResponse {
  is_liked: boolean;
  like_count: number;
}

export interface LikeStatusResponse {
  prod_id: number;
  is_liked: boolean;
  like_count: number;
}

// 좋아요 토글
export async function toggleLike(prodId: number): Promise<LikeToggleResponse> {
  return apiRequest<LikeToggleResponse>(`/likes/toggle/${prodId}`, {
    method: 'POST',
  });
}

// 좋아요 상태 조회
export async function getLikeStatus(prodId: number): Promise<LikeStatusResponse> {
  return apiRequest<LikeStatusResponse>(`/likes/status/${prodId}`, {
    method: 'GET',
  });
}