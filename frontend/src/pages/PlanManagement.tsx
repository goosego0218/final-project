import { useState } from "react";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Crown } from "lucide-react";

const PlanManagement = () => {
  // Mock data - 실제로는 API에서 가져올 데이터
  const [tokenUsage] = useState({
    used: 7500,
    total: 10000,
    plan: "Pro Plan"
  });

  const usagePercentage = (tokenUsage.used / tokenUsage.total) * 100;
  const remainingTokens = tokenUsage.total - tokenUsage.used;

  const plans = [
    {
      name: "Free",
      price: "₩0",
      tokens: "5,000 토큰/월",
      features: [
        "기본 로고 생성",
        "기본 숏폼 생성",
        "워터마크 포함",
        "커뮤니티 지원"
      ],
      icon: Zap,
      current: false
    },
    {
      name: "Pro",
      price: "₩29,900",
      tokens: "10,000 토큰/월",
      features: [
        "무제한 로고 생성",
        "무제한 숏폼 생성",
        "워터마크 제거",
        "우선 지원",
        "고급 편집 기능"
      ],
      icon: TrendingUp,
      current: true
    },
    {
      name: "Enterprise",
      price: "₩99,900",
      tokens: "50,000 토큰/월",
      features: [
        "Pro 플랜의 모든 기능",
        "팀 협업 기능",
        "API 접근",
        "전담 지원",
        "커스텀 브랜딩"
      ],
      icon: Crown,
      current: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* 현재 토큰 사용량 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>토큰 사용량</span>
                <Badge variant="secondary">{tokenUsage.plan}</Badge>
              </CardTitle>
              <CardDescription>
                이번 달 토큰 사용 현황을 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">사용량</span>
                  <span className="font-medium">
                    {tokenUsage.used.toLocaleString()} / {tokenUsage.total.toLocaleString()} 토큰
                  </span>
                </div>
                <Progress value={usagePercentage} className="h-3" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {usagePercentage.toFixed(1)}% 사용됨
                  </span>
                  <span className="font-medium text-primary">
                    {remainingTokens.toLocaleString()} 토큰 남음
                  </span>
                </div>
              </div>
              
              {usagePercentage > 80 && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium">
                    토큰이 80% 이상 사용되었습니다. 플랜 업그레이드를 고려해보세요.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 플랜 선택 */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">플랜 선택</h2>
              <p className="text-muted-foreground mt-2">
                프로젝트에 맞는 플랜을 선택하세요
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const Icon = plan.icon;
                return (
                  <Card 
                    key={plan.name}
                    className={plan.current ? "border-primary shadow-lg" : ""}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <Icon className="h-8 w-8 text-primary" />
                        {plan.current && (
                          <Badge variant="default">현재 플랜</Badge>
                        )}
                      </div>
                      <CardTitle>{plan.name}</CardTitle>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">{plan.price}</span>
                        <span className="text-muted-foreground">/월</span>
                      </div>
                      <CardDescription className="font-medium">
                        {plan.tokens}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-1">✓</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button 
                        className="w-full" 
                        variant={plan.current ? "secondary" : "default"}
                        disabled={plan.current}
                      >
                        {plan.current ? "현재 플랜" : "플랜 선택"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* 사용 내역 */}
          <Card>
            <CardHeader>
              <CardTitle>최근 사용 내역</CardTitle>
              <CardDescription>
                최근 7일간의 토큰 사용 내역입니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { date: "2024-01-15", action: "로고 생성", tokens: 500 },
                  { date: "2024-01-14", action: "숏폼 생성", tokens: 1200 },
                  { date: "2024-01-13", action: "로고 생성", tokens: 500 },
                  { date: "2024-01-12", action: "숏폼 생성", tokens: 1200 },
                  { date: "2024-01-11", action: "로고 생성", tokens: 500 }
                ].map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                    <span className="text-sm font-medium">
                      -{item.tokens.toLocaleString()} 토큰
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PlanManagement;
