import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { signUp, login, LoginRequest } from "@/lib/api";

interface AuthModalsProps {
  isLoginOpen: boolean;
  isSignUpOpen: boolean;
  onLoginClose: () => void;
  onSignUpClose: () => void;
  onSwitchToSignUp: () => void;
  onSwitchToLogin: () => void;
  onLoginSuccess: (rememberMe: boolean, isSignUp?: boolean) => void;
}

export const AuthModals = ({
  isLoginOpen,
  isSignUpOpen,
  onLoginClose,
  onSignUpClose,
  onSwitchToSignUp,
  onSwitchToLogin,
  onLoginSuccess,
}: AuthModalsProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [signUpStep, setSignUpStep] = useState(1);
  const [signUpLoginId, setSignUpLoginId] = useState("");
  const [signUpNickname, setSignUpNickname] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // 로그인 폼 상태
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // 회원가입 다이얼로그가 열릴 때 상태 초기화
  useEffect(() => {
    if (isSignUpOpen) {
      setSignUpStep(1);
      setSignUpLoginId("");
      setSignUpNickname("");
      setSignUpPassword("");
      setSignUpConfirmPassword("");
      setAgreeToTerms(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setIsLoading(false);
    }
  }, [isSignUpOpen]);

  // 로그인 다이얼로그가 열릴 때 상태 초기화
  useEffect(() => {
    if (isLoginOpen) {
      setLoginId("");
      setLoginPassword("");
      setRememberMe(false);
      setShowPassword(false);
      setIsLoading(false);
    }
  }, [isLoginOpen]);

  const handleGoogleLogin = () => {
    toast({
      title: "Google 로그인",
      description: "Google 로그인 기능은 곧 제공될 예정입니다.",
      status: "warning",
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await login({
        login_id: loginId,
        password: loginPassword,
      });

      // 토큰 저장
      if (rememberMe) {
        localStorage.setItem('accessToken', response.access_token);
        sessionStorage.removeItem('accessToken');
      } else {
        sessionStorage.setItem('accessToken', response.access_token);
        localStorage.removeItem('accessToken');
      }

      // 사용자 프로필 정보는 로그인 API에서 반환되지 않으므로, 
      // 별도로 조회하거나 여기서는 기본값으로 설정
      localStorage.setItem('userProfile', JSON.stringify({
        id: loginId,
        nickname: loginId, // 닉네임은 별도 API로 조회 필요
      }));
      localStorage.setItem('isLoggedIn', 'true');
      sessionStorage.setItem('isLoggedIn', 'true');

      toast({
        title: "로그인 되었습니다",
        description: "환영합니다!",
        status: "success",
      });

      onLoginSuccess(rememberMe);
      onLoginClose();
    } catch (error) {
      toast({
        title: "로그인 실패",
        description: error instanceof Error ? error.message : "아이디 또는 비밀번호가 잘못되었습니다.",
        status: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const idInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    if (idInput.value.trim()) {
      setSignUpLoginId(idInput.value.trim());
      setSignUpStep(2);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 비밀번호 확인 검증
    if (signUpPassword !== signUpConfirmPassword) {
      toast({
        title: "비밀번호 불일치",
        description: "비밀번호와 비밀번호 확인이 일치하지 않습니다.",
        status: "error",
      });
      return;
    }

    // 비밀번호 길이 검증 (최소 8자)
    if (signUpPassword.length < 8) {
      toast({
        title: "비밀번호 길이",
        description: "비밀번호는 최소 8자 이상이어야 합니다.",
        status: "error",
      });
      return;
    }

    if (!agreeToTerms) {
      toast({
        title: "약관 동의 필요",
        description: "이용약관 및 개인정보 처리방침에 동의해주세요.",
        status: "warning",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 회원가입 API 호출
      const user = await signUp({
        login_id: signUpLoginId,
        password: signUpPassword,
        nickname: signUpNickname,
      });

      // 회원가입 성공 후 자동 로그인
      try {
        const loginResponse = await login({
          login_id: signUpLoginId,
          password: signUpPassword,
        });

        // 토큰 저장 (회원가입 시에는 자동 로그인으로 처리)
        localStorage.setItem('accessToken', loginResponse.access_token);
        sessionStorage.setItem('accessToken', loginResponse.access_token);
        localStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('isLoggedIn', 'true');

        // 사용자 프로필 저장
        localStorage.setItem('userProfile', JSON.stringify({
          id: user.login_id,
          nickname: user.nickname,
        }));

        toast({
          title: "회원가입이 완료되었습니다",
          description: "MAKERY에 오신 것을 환영합니다!",
          status: "success",
        });

        // 상태 초기화
        setSignUpStep(1);
        setSignUpLoginId("");
        setSignUpNickname("");
        setSignUpPassword("");
        setSignUpConfirmPassword("");
        setAgreeToTerms(false);

        onLoginSuccess(true, true);
        onSignUpClose();
      } catch (loginError) {
        // 회원가입은 성공했지만 로그인 실패
        toast({
          title: "회원가입 완료",
          description: "회원가입이 완료되었습니다. 로그인해주세요.",
          status: "success",
        });
        onSignUpClose();
        onSwitchToLogin();
      }
    } catch (error) {
      // 회원가입 실패 (아이디 중복 등)
      const errorMessage = error instanceof Error ? error.message : "회원가입에 실패했습니다.";
      
      if (errorMessage.includes("이미 사용 중인 아이디")) {
        toast({
          title: "아이디 중복",
          description: errorMessage,
          status: "error",
        });
        // Step 1로 돌아가서 아이디 재입력
        setSignUpStep(1);
      } else {
        toast({
          title: "회원가입 실패",
          description: errorMessage,
          status: "error",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpClose = () => {
    setSignUpStep(1);
    setSignUpLoginId("");
    setSignUpNickname("");
    setSignUpPassword("");
    setSignUpConfirmPassword("");
    setAgreeToTerms(false);
    setIsLoading(false);
    onSignUpClose();
  };

  const handleSwitchToLoginFromSignUp = () => {
    setSignUpStep(1);
    setSignUpLoginId("");
    setSignUpNickname("");
    setSignUpPassword("");
    setSignUpConfirmPassword("");
    setAgreeToTerms(false);
    setIsLoading(false);
    onSwitchToLogin();
  };

  return (
    <>
      {/* Login Modal */}
      <Dialog open={isLoginOpen} onOpenChange={onLoginClose}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold tracking-tight text-foreground mb-2">
                MAKERY
              </div>
              <DialogTitle className="text-2xl font-semibold">
                계정에 로그인
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                다시 만나서 반가워요. 로그인 방법을 선택하세요.
              </DialogDescription>
            </div>

            {/* Google Login Button */}
            <Button
              variant="outline"
              className="w-full h-11"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google로 계속하기
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  또는 아이디로 계속하기
                </span>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-id">아이디</Label>
                <Input
                  id="login-id"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">비밀번호</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    className="pr-10"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Options Row */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    자동 로그인
                  </label>
                </div>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  disabled={isLoading}
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  "로그인"
                )}
              </Button>
            </form>

            {/* Switch to Sign Up */}
            <div className="text-center text-sm text-muted-foreground">
              아직 계정이 없으신가요?{" "}
              <button
                onClick={onSwitchToSignUp}
                className="text-primary hover:underline font-medium"
                disabled={isLoading}
              >
                회원가입
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign Up Modal */}
      <Dialog open={isSignUpOpen} onOpenChange={handleSignUpClose}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold tracking-tight text-foreground mb-2">
                MAKERY
              </div>
              <DialogTitle className="text-2xl font-semibold">
                {signUpStep === 1 ? "MAKERY 시작하기" : "계정 만들기"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                AI로 로고와 숏폼을 만들 준비가 되셨나요?
              </DialogDescription>
            </div>

            {signUpStep === 1 ? (
              <>
                {/* Step 1: ID Input */}
                {/* Google Sign Up Button */}
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google로 가입하기
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      또는 아이디로 가입하기
                    </span>
                  </div>
                </div>

                {/* ID Input Form */}
                <form onSubmit={handleContinueToStep2} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-id">아이디</Label>
                    <Input
                      id="signup-id"
                      type="text"
                      placeholder="아이디를 입력하세요"
                      required
                      value={signUpLoginId}
                      onChange={(e) => setSignUpLoginId(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  {/* Continue Button */}
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    계속하기
                  </Button>
                </form>

                {/* Switch to Login */}
                <div className="text-center text-sm text-muted-foreground">
                  이미 계정이 있으신가요?{" "}
                  <button
                    onClick={handleSwitchToLoginFromSignUp}
                    className="text-primary hover:underline font-medium"
                    disabled={isLoading}
                  >
                    로그인
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Password Setup */}
                {/* Display ID */}
                <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                  아이디: <span className="font-medium text-foreground">{signUpLoginId}</span>
                </div>

                {/* Password Form */}
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-nickname">닉네임</Label>
                    <Input
                      id="signup-nickname"
                      type="text"
                      placeholder="닉네임을 입력하세요"
                      required
                      value={signUpNickname}
                      onChange={(e) => setSignUpNickname(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">비밀번호</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        className="pr-10"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={isLoading}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">최소 8자 이상 입력해주세요</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">비밀번호 확인</Label>
                    <div className="relative">
                      <Input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        className="pr-10"
                        value={signUpConfirmPassword}
                        onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={isLoading}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Terms Agreement */}
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={agreeToTerms}
                      onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                      className="mt-0.5"
                      disabled={isLoading}
                    />
                    <label
                      htmlFor="terms"
                      className="text-sm text-muted-foreground leading-tight cursor-pointer"
                    >
                      <button type="button" className="text-primary hover:underline">
                        이용약관
                      </button>{" "}
                      및{" "}
                      <button type="button" className="text-primary hover:underline">
                        개인정보 처리방침
                      </button>
                      에 동의합니다.
                    </label>
                  </div>

                  {/* Submit Button */}
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        회원가입 중...
                      </>
                    ) : (
                      "회원가입"
                    )}
                  </Button>
                </form>

                {/* Switch to Login */}
                <div className="text-center text-sm text-muted-foreground">
                  이미 계정이 있으신가요?{" "}
                  <button
                    onClick={handleSwitchToLoginFromSignUp}
                    className="text-primary hover:underline font-medium"
                    disabled={isLoading}
                  >
                    로그인
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
