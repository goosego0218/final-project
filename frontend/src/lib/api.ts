// API base URL 설정
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
