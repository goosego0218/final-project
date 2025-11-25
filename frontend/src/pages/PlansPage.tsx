import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Zap, TrendingUp, Clock } from "lucide-react";

const PlansPage = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // 초기 로그인 상태 확인
  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true');
  }, []);
  
  const plans = [
    {
      name: "Basic",
      price: "₩9,900",
      period: "/월",
      features: ["월 10개 프로젝트", "기본 로고 생성", "커뮤니티 지원"],
      tokens: 200,
    },
    {
      name: "Pro",
      price: "₩29,900",
      period: "/월",
      features: ["무제한 프로젝트", "고급 AI 모델", "우선 지원", "상업적 이용"],
      featured: true,
      tokens: 1000,
    },
    {
      name: "Enterprise",
      price: "문의",
      period: "",
      features: ["전담 지원", "맞춤형 AI 모델", "API 접근", "팀 협업 기능"],
      tokens: "무제한",
    },
  ];

  const currentPlan = {
    name: "Basic",
    tokensUsed: 132,
    tokensTotal: 200,
  };

  const recentUsage = [
    { date: "2024-01-15", project: "로고 디자인 A", tokens: 15, type: "로고" },
    { date: "2024-01-14", project: "숏폼 영상 B", tokens: 25, type: "숏폼" },
    { date: "2024-01-13", project: "로고 디자인 C", tokens: 12, type: "로고" },
    { date: "2024-01-12", project: "숏폼 영상 D", tokens: 30, type: "숏폼" },
    { date: "2024-01-11", project: "로고 디자인 E", tokens: 10, type: "로고" },
  ];

  // 로그아웃 상태일 때 - 플랜 소개
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20">
          <div className="max-w-6xl mx-auto px-8 py-16">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                플랜 관리
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                프로젝트 규모에 맞는 플랜을 선택하세요.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <Card 
                  key={plan.name} 
                  className={`relative ${plan.featured ? 'border-primary shadow-xl scale-105' : ''}`}
                >
                  {plan.featured && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                      인기
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>
                      <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-primary flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className="w-full" 
                      variant={plan.featured ? "default" : "outline"}
                    >
                      선택하기
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // 로그인 상태일 때 - 토큰 사용 내역, 플랜 선택, 최근 사용 내역
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-20">
        <div className="max-w-6xl mx-auto px-8 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              플랜 관리
            </h1>
            <p className="text-xl text-muted-foreground">
              토큰 사용량을 확인하고 플랜을 관리하세요
            </p>
          </div>

          <Tabs defaultValue="usage" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="usage">토큰 사용 내역</TabsTrigger>
              <TabsTrigger value="plans">플랜 선택</TabsTrigger>
              <TabsTrigger value="history">최근 사용 내역</TabsTrigger>
            </TabsList>

            {/* 토큰 사용 내역 */}
            <TabsContent value="usage" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    현재 토큰 사용량
                  </CardTitle>
                  <CardDescription>이번 달 토큰 사용 현황입니다</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">사용량</span>
                      <span className="text-2xl font-bold">
                        {currentPlan.tokensUsed} / {currentPlan.tokensTotal}
                      </span>
                    </div>
                    <Progress 
                      value={(currentPlan.tokensUsed / currentPlan.tokensTotal) * 100} 
                      className="h-3"
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      {currentPlan.tokensTotal - currentPlan.tokensUsed}개의 토큰이 남았습니다
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-muted/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">현재 플랜</p>
                            <p className="text-2xl font-bold">{currentPlan.name}</p>
                          </div>
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            활성
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-muted/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">이번 달 생성</p>
                            <p className="text-2xl font-bold">24개</p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-primary" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 플랜 선택 */}
            <TabsContent value="plans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <Card 
                    key={plan.name} 
                    className={`relative ${
                      plan.name === currentPlan.name 
                        ? 'border-primary shadow-lg' 
                        : plan.featured 
                        ? 'border-primary/50 shadow-md' 
                        : ''
                    }`}
                  >
                    {plan.featured && plan.name !== currentPlan.name && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                        인기
                      </div>
                    )}
                    {plan.name === currentPlan.name && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                        현재 플랜
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      <CardDescription>
                        <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                        <span className="text-muted-foreground">{plan.period}</span>
                      </CardDescription>
                      <div className="flex items-center gap-2 mt-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">
                          {typeof plan.tokens === 'number' 
                            ? `${plan.tokens.toLocaleString()}개 토큰/월` 
                            : plan.tokens}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <Check className="w-5 h-5 text-primary flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button 
                        className="w-full" 
                        variant={plan.name === currentPlan.name ? "secondary" : plan.featured ? "default" : "outline"}
                        disabled={plan.name === currentPlan.name}
                      >
                        {plan.name === currentPlan.name ? "현재 플랜" : "플랜 변경"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* 최근 사용 내역 */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    최근 사용 내역
                  </CardTitle>
                  <CardDescription>최근 프로젝트별 토큰 사용 내역입니다</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentUsage.map((usage, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Zap className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{usage.project}</p>
                            <p className="text-sm text-muted-foreground">{usage.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-foreground">{usage.tokens} 토큰</p>
                          <Badge variant="outline" className="text-xs">
                            {usage.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default PlansPage;
