import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const ThemeToggle = () => {
  // 초기 상태를 localStorage에서 즉시 읽어서 깜빡임 방지
  // index.html의 스크립트가 이미 테마를 적용했으므로, 상태만 동기화
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const theme = localStorage.getItem("theme");
      // document.documentElement.classList는 이미 index.html 스크립트에서 적용됨
      // localStorage에 값이 없으면 다크모드를 기본으로 설정
      return theme === "dark" || theme === null;
    }
    return true; // 기본값을 다크모드로 설정
  });

  useEffect(() => {
    // 초기 테마 확인 및 상태 동기화
    const theme = localStorage.getItem("theme");
    // localStorage에 값이 없으면 다크모드를 기본으로 설정
    const shouldBeDark = theme === "dark" || theme === null;
    
    // 상태와 실제 DOM 클래스 동기화
    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
      // localStorage에 값이 없으면 다크모드로 저장
      if (theme === null) {
        localStorage.setItem("theme", "dark");
      }
    } else {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-secondary transition-colors"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-muted-foreground" />
      ) : (
        <Moon className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
  );
};

export default ThemeToggle;
