import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  FileText, 
  Loader2, 
  Calendar,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { Resume } from "@shared/schema";
import { formatBytes, formatDate } from "@/lib/utils";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  const { data: resumes, isLoading } = useQuery<Resume[]>({
    queryKey: ["/api/resumes"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resumes"] });
      setUploadingFile(null);
      toast({
        title: "Success",
        description: "Resume uploaded and text extracted successfully!",
      });
    },
    onError: (error: Error) => {
      setUploadingFile(null);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (resumeId: string) => {
      const response = await apiRequest("POST", `/api/resumes/${resumeId}/analyze`, {});
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/resumes"] });
      setLocation(`/results/${data.id}`);
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "Failed to analyze resume. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOCX, PNG, JPG, or TXT file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingFile(file);
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="h-16 border-b flex items-center px-6 lg:px-12">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          <span className="text-lg font-semibold">ResuMatch Pro</span>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 lg:p-12 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Upload your resume to get AI-powered analysis and improvement suggestions.
          </p>
        </div>

        <Card
          className={`border-2 border-dashed transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border"
          } rounded-xl`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          data-testid="card-upload-zone"
        >
          <CardContent className="p-12">
            <button
              type="button"
              onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !uploadMutation.isPending) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              disabled={uploadMutation.isPending}
              className="w-full flex flex-col items-center justify-center text-center space-y-4 hover-elevate active-elevate-2 rounded-lg p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label="Upload resume file - click to browse or drag and drop"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-16 h-16 text-primary animate-spin" />
                  <div>
                    <p className="text-lg font-medium">Uploading and extracting text...</p>
                    {uploadingFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {uploadingFile.name} ({formatBytes(uploadingFile.size)})
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium mb-1">Upload your resume</p>
                    <p className="text-sm text-muted-foreground">
                      Drag and drop or click to browse
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supports PDF, DOCX, PNG, JPG, TXT (max 10MB)
                  </p>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              aria-label="Resume file input"
              data-testid="input-file-upload"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Resumes</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-10 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : resumes && resumes.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {resumes.map((resume) => (
                <Card key={resume.id} className="hover-elevate" data-testid={`card-resume-${resume.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{resume.filename}</CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {formatBytes(resume.filesize)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(resume.createdAt)}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => analyzeMutation.mutate(resume.id)}
                      disabled={analyzeMutation.isPending}
                      className="w-full"
                      data-testid={`button-analyze-${resume.id}`}
                    >
                      {analyzeMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Analyze with AI
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-lg font-medium text-muted-foreground">No resumes yet</p>
                  <p className="text-base text-muted-foreground mt-1">
                    Upload your first resume to get started
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
