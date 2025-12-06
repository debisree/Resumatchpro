import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target, FileText, MapPin, Briefcase, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { JobMatch } from "@shared/schema";

const JOB_ROLES = [
  "Data Scientist",
  "Machine Learning Engineer",
  "AI Engineer",
  "Software Developer",
  "Full Stack Developer",
  "Backend Developer",
  "Frontend Developer",
  "Data Engineer",
  "Prompt Engineer",
  "Cloud Architect",
];

const LOCATIONS = [
  "San Francisco Bay Area",
  "Los Angeles",
  "New York City",
  "Boston",
  "Washington DC",
  "Philadelphia",
  "Chicago",
  "Seattle",
  "San Diego",
  "Dallas",
  "Houston",
  "Austin",
  "Atlanta",
  "Raleigh-Durham",
];

export default function JobMatch() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [jobDescription, setJobDescription] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");

  const analyzeMutation = useMutation({
    mutationFn: async (data: {jobDescription?: string; jobRole?: string; jobLocation?: string}) => {
      const response = await apiRequest("POST", "/api/job-matches/analyze", data);
      return await response.json();
    },
    onSuccess: (data: JobMatch) => {
      setLocation(`/job-matches/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAnalyzeWithText = () => {
    analyzeMutation.mutate({ jobDescription });
  };

  const handleAnalyzeWithRole = () => {
    analyzeMutation.mutate({ jobRole: selectedRole, jobLocation: selectedLocation });
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-4xl mx-auto p-6 lg:p-12 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Job Match Analysis</h1>
          <p className="text-muted-foreground">
            Compare your resume against a job description to find alignment and gaps.
          </p>
        </div>

        <Tabs defaultValue="paste" className="w-full">
          <TabsList className="grid w-full grid-cols-2" data-testid="job-match-tabs">
            <TabsTrigger value="paste" data-testid="tab-paste-jd">
              <FileText className="w-4 h-4 mr-2" />
              Paste Job Description
            </TabsTrigger>
            <TabsTrigger value="select" data-testid="tab-select-role">
              <Briefcase className="w-4 h-4 mr-2" />
              Select Role & Location
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
                <CardDescription>
                  Paste the full job description you want to match against your resume
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="job-description">Job Description Text</Label>
                    <Textarea
                      id="job-description"
                      placeholder="Paste the job description here..."
                      className="min-h-[300px] mt-2"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      data-testid="textarea-job-description"
                    />
                  </div>
                  <Button 
                    className="w-full" 
                    size="lg"
                    disabled={!jobDescription.trim() || analyzeMutation.isPending}
                    onClick={handleAnalyzeWithText}
                    data-testid="button-analyze-match"
                  >
                    {analyzeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4 mr-2" />
                        Analyze Match
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="select" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Job Role & Location</CardTitle>
                <CardDescription>
                  Choose a role and location to generate a representative job description
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="role-select">Job Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger id="role-select" data-testid="select-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location-select">Location</Label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger id="location-select" data-testid="select-location">
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATIONS.map((location) => (
                          <SelectItem key={location} value={location}>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3" />
                              {location}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    disabled={!selectedRole || !selectedLocation || analyzeMutation.isPending}
                    onClick={handleAnalyzeWithRole}
                    data-testid="button-analyze-role-match"
                  >
                    {analyzeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4 mr-2" />
                        Analyze Match
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
