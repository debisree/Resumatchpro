import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Lightbulb, FileText, BarChart3, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Analysis, Resume } from "@shared/schema";

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
  const { toast } = useToast();

  const { data: analysis, isLoading: analysisLoading } = useQuery<Analysis>({
    queryKey: [`/api/analyses/${id}`],
    enabled: !!id,
  });

  const { data: resume, isLoading: resumeLoading } = useQuery<Resume>({
    queryKey: [`/api/resumes/${analysis?.resumeId}`],
    enabled: !!analysis?.resumeId,
  });

  const isLoading = analysisLoading || resumeLoading;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Resume text copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy text to clipboard",
        variant: "destructive",
      });
    }
  };

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
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto p-6 lg:p-12 pb-2">
        <div className="flex items-center gap-4 mb-6">
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
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-12 pb-12">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8" data-testid="tabs-list">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="details" data-testid="tab-details">
              <Lightbulb className="w-4 h-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger value="resume" data-testid="tab-resume">
              <FileText className="w-4 h-4 mr-2" />
              Resume
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8" data-testid="content-overview">
            <Card className="max-w-2xl mx-auto">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-semibold mb-2">Resume Completeness Score</CardTitle>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-6xl font-bold" data-testid="text-completeness-score">
                    {analysis.completenessScore}
                  </span>
                  <span className="text-2xl text-muted-foreground">/100</span>
                </div>
                <Progress value={analysis.completenessScore} className="h-3 mb-4" />
                <CardDescription className="text-base leading-relaxed">
                  {analysis.completenessRationale}
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {Object.entries(analysis.sectionScores).map(([key, score]) => {
                const scoreInfo = SCORE_LABELS[score] || SCORE_LABELS[0];
                return (
                  <Card key={key}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold">{SECTION_NAMES[key] || key}</h3>
                        <Badge variant={scoreInfo.variant}>{scoreInfo.label}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={(score / 5) * 100} className="h-2" />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {score}/5
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-6" data-testid="content-details">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold">Section Quality Breakdown</CardTitle>
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
                      Improvement Suggestions
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
          </TabsContent>

          <TabsContent value="resume" className="space-y-6" data-testid="content-resume">
            <Card className="max-w-4xl mx-auto">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-semibold">Extracted Resume Text</CardTitle>
                    <CardDescription className="mt-1">
                      This is the text extracted from your uploaded resume file
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(resume?.extractedText || "")}
                    data-testid="button-copy-text"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                  <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed" data-testid="resume-text">
                    {resume?.extractedText || "No text available"}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
