import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Lightbulb } from "lucide-react";
import type { Analysis, Resume } from "@shared/schema";
import { ScoreDial } from "@/components/score-dial";

const SCORE_LABELS: Record<number, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  0: { label: "Missing", variant: "destructive" },
  1: { label: "Weak", variant: "destructive" },
  2: { label: "Weak", variant: "destructive" },
  3: { label: "Fair", variant: "secondary" },
  4: { label: "Strong", variant: "default" },
  5: { label: "Perfect", variant: "default" },
};

const SECTION_NAMES: Record<string, string> = {
  summary: "Summary",
  education: "Education",
  experience: "Experience",
  other: "Other",
};

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: analysis, isLoading: analysisLoading } = useQuery<Analysis>({
    queryKey: [`/api/analyses/${id}`],
    enabled: !!id,
  });

  const { data: resume, isLoading: resumeLoading } = useQuery<Resume>({
    queryKey: [`/api/resumes/${analysis?.resumeId}`],
    enabled: !!analysis?.resumeId,
  });

  const isLoading = analysisLoading || resumeLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="h-16 border-b flex items-center px-6 lg:px-12 gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-6 w-48" />
        </nav>
        <main className="max-w-7xl mx-auto p-6 lg:p-12 space-y-12">
          <div className="flex flex-col items-center space-y-8">
            <Skeleton className="w-48 h-48 rounded-full" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-64" />
          </div>
        </main>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center space-y-4">
            <p className="text-lg font-medium">Analysis not found</p>
            <Button onClick={() => setLocation("/dashboard")}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="h-16 border-b flex items-center px-6 lg:px-12 sticky top-0 bg-background z-50">
        <div className="flex items-center gap-4 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">
              {resume?.filename || "Analysis Results"}
            </h1>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 lg:p-12 space-y-12">
        <div className="flex flex-col items-center text-center space-y-8">
          <ScoreDial score={analysis.completenessScore} />
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold mb-4">Resume Completeness</h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              {analysis.completenessRationale}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Section Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {Object.entries(analysis.sectionScores).map(([key, score], index, array) => {
                    const scoreInfo = SCORE_LABELS[score] || SCORE_LABELS[0];
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between px-4 py-3 ${
                          index < array.length - 1 ? "border-b" : ""
                        }`}
                        data-testid={`section-${key}`}
                      >
                        <span className="text-base font-medium">
                          {SECTION_NAMES[key] || key}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {score}/5
                          </span>
                          <Badge variant={scoreInfo.variant} className="min-w-[80px] justify-center">
                            {scoreInfo.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3" data-testid="suggestions-list">
                  {analysis.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex gap-3" data-testid={`suggestion-${index}`}>
                      <div className="mt-1 flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                      <p className="text-base leading-relaxed">{suggestion}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
