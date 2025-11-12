import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, AlertCircle, Send, FileDown, Loader2 } from "lucide-react";
import type { JobMatch } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

const SEVERITY_STYLES = {
  high: { variant: "destructive" as const, label: "Critical" },
  medium: { variant: "default" as const, label: "Important" },
  low: { variant: "secondary" as const, label: "Minor" },
};

const PROFICIENCY_LEVELS = [
  { value: "none", label: "Not at all" },
  { value: "basic", label: "Basic" },
  { value: "moderate", label: "Moderate" },
  { value: "advanced", label: "Advanced" },
];

export default function JobMatchResults() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [gapResponses, setGapResponses] = useState<Record<number, string>>({});

  const { data: jobMatch, isLoading } = useQuery<JobMatch>({
    queryKey: [`/api/job-matches/${id}`],
    enabled: !!id,
  });

  const submitResponsesMutation = useMutation({
    mutationFn: async (responses: Array<{ gapIndex: number; proficiencyLevel: string }>) => {
      const response = await apiRequest("POST", `/api/job-matches/${id}/submit-responses`, {
        gapResponses: responses,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/job-matches/${id}`] });
      toast({
        title: "Responses submitted",
        description: "Generating your final recommendation...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateResumeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/job-matches/${id}/generate-resume`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/job-matches/${id}`] });
      toast({
        title: "Resume generated",
        description: "Your tailored resume is ready for download!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProficiencyChange = (gapIndex: number, value: string) => {
    setGapResponses((prev) => ({ ...prev, [gapIndex]: value }));
  };

  const handleSubmitResponses = () => {
    const responses = Object.entries(gapResponses).map(([index, level]) => ({
      gapIndex: parseInt(index),
      proficiencyLevel: level,
    }));
    submitResponsesMutation.mutate(responses);
  };

  const handleDownloadResume = async () => {
    if (!jobMatch?.tailoredResumeContent) return;

    const content = jobMatch.tailoredResumeContent;
    const lines = content.split('\n').filter(line => line.trim());
    
    const children: Paragraph[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('# ')) {
        children.push(
          new Paragraph({
            text: trimmedLine.substring(2),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (trimmedLine.startsWith('## ')) {
        children.push(
          new Paragraph({
            text: trimmedLine.substring(3),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 150, after: 80 },
          })
        );
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
        children.push(
          new Paragraph({
            text: trimmedLine.substring(2),
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine.substring(2, trimmedLine.length - 2),
                bold: true,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      } else if (trimmedLine) {
        children.push(
          new Paragraph({
            text: trimmedLine,
            spacing: { after: 60 },
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `tailored-resume-${jobMatch.jobRole || "job"}.docx`);
  };

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

  const allGapsAnswered = jobMatch.gaps.every((_, index) => gapResponses[index]);
  const hasSubmittedResponses = !!jobMatch.gapResponses && jobMatch.gapResponses.length > 0;
  const hasFinalVerdict = !!jobMatch.finalVerdict;
  const hasGeneratedResume = !!jobMatch.tailoredResumeContent;

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

        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Your Strengths
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
            <CardDescription>
              Please indicate your proficiency level for each missing skill or requirement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6" data-testid="gaps-list">
              {jobMatch.gaps.map((gap, index) => (
                <div key={index} className="space-y-3" data-testid={`gap-${index}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant={SEVERITY_STYLES[gap.severity].variant}>
                      {SEVERITY_STYLES[gap.severity].label}
                    </Badge>
                    <span className="font-medium text-sm">{gap.category}</span>
                  </div>
                  <p className="text-base leading-relaxed pl-4">
                    {gap.description}
                  </p>
                  <div className="pl-4">
                    <Select
                      value={gapResponses[index] || ""}
                      onValueChange={(value) => handleProficiencyChange(index, value)}
                      disabled={hasSubmittedResponses}
                    >
                      <SelectTrigger 
                        className="w-full sm:w-64"
                        data-testid={`select-gap-${index}`}
                      >
                        <SelectValue placeholder="Select your proficiency level" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFICIENCY_LEVELS.map((level) => (
                          <SelectItem 
                            key={level.value} 
                            value={level.value}
                            data-testid={`option-${level.value}`}
                          >
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {!hasSubmittedResponses && (
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSubmitResponses}
                  disabled={!allGapsAnswered || submitResponsesMutation.isPending}
                  size="lg"
                  data-testid="button-submit-responses"
                >
                  {submitResponsesMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Responses
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {hasFinalVerdict && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Final Recommendation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base leading-relaxed">{jobMatch.finalVerdict}</p>
              
              {jobMatch.shouldApply !== null && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-4">
                    Note: This is just a recommendation with no guarantees. We believe in positivity, 
                    so you should apply anyway to take your chance!
                  </p>
                </div>
              )}

              {!hasGeneratedResume && (
                <Button
                  onClick={() => generateResumeMutation.mutate()}
                  disabled={generateResumeMutation.isPending}
                  size="lg"
                  className="w-full"
                  data-testid="button-generate-resume"
                >
                  {generateResumeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Resume...
                    </>
                  ) : (
                    "Generate Tailored Resume"
                  )}
                </Button>
              )}

              {hasGeneratedResume && (
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Your tailored resume is ready!
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      This resume is ATS-friendly and optimized for the position based on your profile.
                    </p>
                  </div>
                  <Button
                    onClick={handleDownloadResume}
                    size="lg"
                    className="w-full"
                    data-testid="button-download-resume"
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Download Tailored Resume
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
