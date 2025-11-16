import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Target, MapPin, Clock, AlertCircle, CheckCircle2, BookOpen, Trophy, Lightbulb } from "lucide-react";
import type { CareerRoadmap } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const roadmapSchema = z.object({
  dreamRole: z.string().min(3, "Please enter your dream role (at least 3 characters)"),
  dreamLocation: z.string().min(2, "Please enter your dream location"),
  timeframe: z.string().min(1, "Please select a timeframe"),
});

type RoadmapFormData = z.infer<typeof roadmapSchema>;

const TIMEFRAME_OPTIONS = [
  { value: "6 months", label: "6 Months" },
  { value: "1 year", label: "1 Year" },
  { value: "18 months", label: "18 Months" },
  { value: "2 years", label: "2 Years" },
];

export default function CareerRoadmap() {
  const { toast } = useToast();
  const [selectedRoadmap, setSelectedRoadmap] = useState<CareerRoadmap | null>(null);

  const { data: roadmaps = [], isLoading: loadingRoadmaps } = useQuery<CareerRoadmap[]>({
    queryKey: ["/api/career-roadmaps"],
  });

  const form = useForm<RoadmapFormData>({
    resolver: zodResolver(roadmapSchema),
    defaultValues: {
      dreamRole: "",
      dreamLocation: "",
      timeframe: "",
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: RoadmapFormData) => {
      const response = await apiRequest("POST", "/api/career-roadmaps", data);
      return await response.json();
    },
    onSuccess: (data: CareerRoadmap) => {
      queryClient.invalidateQueries({ queryKey: ["/api/career-roadmaps"] });
      setSelectedRoadmap(data);
      toast({
        title: "Career roadmap generated!",
        description: "Your personalized career guidance is ready.",
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

  const onSubmit = (data: RoadmapFormData) => {
    generateMutation.mutate(data);
  };

  const displayRoadmap = selectedRoadmap || (roadmaps.length > 0 ? roadmaps[0] : null);

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-6xl mx-auto p-6 lg:p-12 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2" data-testid="text-title">Career Roadmap</h1>
          <p className="text-muted-foreground text-lg">
            Get personalized guidance on how to reach your dream role
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Define Your Career Goal
            </CardTitle>
            <CardDescription>
              Tell us about your dream role and we'll create a personalized action plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="dreamRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dream Role</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Senior Data Scientist, Product Manager, Software Architect"
                          {...field}
                          data-testid="input-dream-role"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dreamLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dream Location</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., San Francisco Bay Area, Remote, New York"
                          {...field}
                          data-testid="input-dream-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timeframe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeframe to Get Ready</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-timeframe">
                            <SelectValue placeholder="Select timeframe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIMEFRAME_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  size="lg"
                  disabled={generateMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-roadmap"
                >
                  {generateMutation.isPending ? "Generating Roadmap..." : "Generate Career Roadmap"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {displayRoadmap && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{displayRoadmap.dreamRole}</h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{displayRoadmap.dreamLocation}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{displayRoadmap.timeframe}</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Current Gaps
                </CardTitle>
                <CardDescription>
                  Areas to focus on to bridge the gap between your current skills and your dream role
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {displayRoadmap.currentGaps.map((gap, index) => (
                    <li key={index} className="flex items-start gap-3" data-testid={`gap-${index}`}>
                      <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
                      <span className="text-sm">{gap}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  Skills to Acquire
                </CardTitle>
                <CardDescription>
                  Key skills you need to develop to succeed in your dream role
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {displayRoadmap.skillsToAcquire.map((skill, index) => (
                    <Badge key={index} variant="secondary" data-testid={`skill-${index}`}>
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Action Plan
                </CardTitle>
                <CardDescription>
                  Step-by-step roadmap to achieve your career goal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {displayRoadmap.actionPlan.map((phase, index) => (
                    <div key={index} className="space-y-3" data-testid={`phase-${index}`}>
                      <div>
                        <h3 className="font-semibold text-lg">{phase.phase}</h3>
                        <p className="text-sm text-muted-foreground">{phase.duration}</p>
                      </div>
                      <ul className="space-y-2 ml-4">
                        {phase.actions.map((action, actionIndex) => (
                          <li key={actionIndex} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                      {index < displayRoadmap.actionPlan.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  Recommended Resources
                </CardTitle>
                <CardDescription>
                  Learning materials to help you develop the required skills
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {displayRoadmap.resources.map((resource, index) => (
                    <li key={index} className="flex items-start gap-3" data-testid={`resource-${index}`}>
                      <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{resource}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-600" />
                  Milestones
                </CardTitle>
                <CardDescription>
                  Track your progress with these key checkpoints
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {displayRoadmap.milestones.map((milestone, index) => (
                    <li key={index} className="flex items-start gap-3" data-testid={`milestone-${index}`}>
                      <Trophy className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{milestone}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {loadingRoadmaps && !displayRoadmap && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
