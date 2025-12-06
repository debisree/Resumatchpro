import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { FileText } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest("POST", "/api/auth/login", { username });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      setLocation("/dashboard");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sign in. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter your name to continue.",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(username.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md mx-auto mt-24">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">ResuMatch Pro</CardTitle>
            <CardDescription className="text-base mt-2">
              AI-Powered Resume Analysis
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">
                Enter your name
              </label>
              <Input
                id="username"
                data-testid="input-username"
                type="text"
                placeholder="John Doe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12"
                disabled={loginMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              data-testid="button-continue"
              className="w-full h-12 font-medium"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Signing in..." : "Continue"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center opacity-70">
            Demo login (no password). Do not upload sensitive information.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
