import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  hasProfile?: boolean;
  bio?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
  login: (provider: string) => void;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  completeSignup: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    // Check for existing session in localStorage
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (provider: string) => {
    // Check if user already exists
    const existingUsers = localStorage.getItem("users");
    const users = existingUsers ? JSON.parse(existingUsers) : {};
    
    const userKey = `${provider}_user`;
    
    if (users[userKey]) {
      // Existing user
      setUser(users[userKey]);
      localStorage.setItem("user", JSON.stringify(users[userKey]));
      setIsNewUser(false);
    } else {
      // New user - need to complete signup
      const mockUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name: `${provider} User`,
        email: `user@${provider}.com`,
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100",
        hasProfile: false,
      };
      setUser(mockUser);
      localStorage.setItem("user", JSON.stringify(mockUser));
      setIsNewUser(true);
    }
  };

  const completeSignup = (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data, hasProfile: true };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      // Save to users registry
      const existingUsers = localStorage.getItem("users");
      const users = existingUsers ? JSON.parse(existingUsers) : {};
      const userKey = `${user.email.split('@')[1].split('.')[0]}_user`;
      users[userKey] = updatedUser;
      localStorage.setItem("users", JSON.stringify(users));
      
      setIsNewUser(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const updateProfile = (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isNewUser,
        login,
        logout,
        updateProfile,
        completeSignup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
