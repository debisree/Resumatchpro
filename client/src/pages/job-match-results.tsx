import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import type { JobMatch } from "@shared/schema";

const SEVERITY_STYLES = {
  high: { variant: "destructive" as const, label: "Critical" },
  medium: { variant: "default" as const, label: "Important" },
  low: { variant: "secondary" as const, label: "Minor" },
};

export default function JobMatchResults() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: jobMatch, isLoading } = useQuery<JobMatch>({
    queryKey: [`/api/job-matches/${id}`],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-full bg-background">
        <div className="max-w-6xl mx-auto p-6 lg:p-12">
          <Skeleton className="h-10 w-3/4 mb-8" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!jobMatch) {
    return (
      <div className="min-h-full bg-background">
        <div className="max-w-6xl mx-auto p-6 lg:p-12">
          <p>Job match analysis not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-6xl mx-auto p-6 lg:p-12 space-y-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/job-match")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">Job Match Analysis</h1>
            {jobMatch.jobRole && jobMatch.jobLocation && (
              <p className="text-muted-foreground mt-1">
                {jobMatch.jobRole} - {jobMatch.jobLocation}
              </p>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold mb-2">Alignment Score</CardTitle>
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-6xl font-bold" data-testid="text-alignment-score">
                {jobMatch.alignmentScore}
              </span>
              <span className="text-2xl text-muted-foreground">%</span>
            </div>
            <Progress value={jobMatch.alignmentScore} className="h-3 mb-4" />
            <CardDescription className="text-base leading-relaxed">
              {jobMatch.alignmentRationale}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3" data-testid="strengths-list">
                {jobMatch.strengths.map((strength, index) => (
                  <li key={index} className="flex gap-3" data-testid={`strength-${index}`}>
                    <div className="mt-1 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
                    </div>
                    <p className="text-base leading-relaxed">{strength}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Gaps to Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="gaps-list">
                {jobMatch.gaps.map((gap, index) => (
                  <div key={index} className="space-y-2" data-testid={`gap-${index}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant={SEVERITY_STYLES[gap.severity].variant}>
                        {SEVERITY_STYLES[gap.severity].label}
                      </Badge>
                      <span className="font-medium text-sm">{gap.category}</span>
                    </div>
                    <p className="text-base leading-relaxed text-muted-foreground pl-4">
                      {gap.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3" data-testid="recommendations-list">
              {jobMatch.recommendations.map((recommendation, index) => (
                <li key={index} className="flex gap-3" data-testid={`recommendation-${index}`}>
                  <div className="mt-1 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                  <p className="text-base leading-relaxed">{recommendation}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
