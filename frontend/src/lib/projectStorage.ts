export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  images?: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  logoCount: number;
  shortFormCount: number;
  date: string;
  messages: Message[];
  lastUpdated: string;
  pinned?: boolean;
<<<<<<< HEAD
  logo?: {
    url: string;
    uploadedAt: string;
  };
=======
>>>>>>> 6c5c159b500ffac8ffb45544f3a1ffbaa2b43002
}

const PROJECTS_KEY = 'makery_projects';
const CURRENT_PROJECT_KEY = 'makery_current_project';

export const projectStorage = {
  // 모든 프로젝트 가져오기 (고정된 프로젝트가 먼저)
  getProjects: (): Project[] => {
    const data = localStorage.getItem(PROJECTS_KEY);
    const projects = data ? JSON.parse(data) : [];
    return projects.sort((a: Project, b: Project) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });
  },

  // 프로젝트 저장
  saveProject: (project: Project): void => {
    const projects = projectStorage.getProjects();
    const existingIndex = projects.findIndex(p => p.id === project.id);
    
    if (existingIndex >= 0) {
      projects[existingIndex] = { ...project, lastUpdated: new Date().toISOString() };
    } else {
      projects.push({ ...project, lastUpdated: new Date().toISOString() });
    }
    
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  },

  // 프로젝트 생성
  createProject: (name: string, description: string): Project => {
    const project: Project = {
      id: `project_${Date.now()}`,
      name,
      description,
      logoCount: 0,
      shortFormCount: 0,
      date: new Date().toLocaleDateString('ko-KR'),
      messages: [],
      lastUpdated: new Date().toISOString(),
    };
    
    projectStorage.saveProject(project);
    projectStorage.setCurrentProject(project.id);
    return project;
  },

  // 특정 프로젝트 가져오기
  getProject: (id: string): Project | null => {
    const projects = projectStorage.getProjects();
    return projects.find(p => p.id === id) || null;
  },

  // 현재 프로젝트 ID 설정
  setCurrentProject: (id: string): void => {
    localStorage.setItem(CURRENT_PROJECT_KEY, id);
  },

  // 현재 프로젝트 ID 가져오기
  getCurrentProjectId: (): string | null => {
    return localStorage.getItem(CURRENT_PROJECT_KEY);
  },

  // 프로젝트에 메시지 추가
  addMessage: (projectId: string, message: Message): void => {
    const project = projectStorage.getProject(projectId);
    if (project) {
      project.messages.push(message);
      
      // 로고/숏폼 카운트 업데이트
      if (message.images && message.images.length > 0) {
        if (message.content.includes("로고")) {
          project.logoCount += message.images.length;
        } else if (message.content.includes("숏폼")) {
          project.shortFormCount += message.images.length;
        }
      }
      
      projectStorage.saveProject(project);
    }
  },

  // 프로젝트 삭제
  deleteProject: (id: string): void => {
    const projects = projectStorage.getProjects();
    const filtered = projects.filter(p => p.id !== id);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered));
    
    if (projectStorage.getCurrentProjectId() === id) {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
    }
  },

  // 프로젝트 고정/해제
  togglePinProject: (id: string): void => {
    const project = projectStorage.getProject(id);
    if (project) {
      project.pinned = !project.pinned;
      projectStorage.saveProject(project);
    }
  },
};
