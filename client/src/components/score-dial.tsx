interface ScoreDialProps {
  score: number;
}

export function ScoreDial({ score }: ScoreDialProps) {
  const size = 192;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "hsl(var(--chart-2))";
    if (score >= 60) return "hsl(var(--chart-3))";
    if (score >= 40) return "hsl(var(--chart-4))";
    return "hsl(var(--destructive))";
  };

  return (
    <div className="relative w-48 h-48 md:w-64 md:h-64" data-testid="score-dial">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 w-full h-full"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getScoreColor(score)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl md:text-6xl font-bold" data-testid="score-value">
          {score}
        </span>
        <span className="text-sm text-muted-foreground mt-1">out of 100</span>
      </div>
    </div>
  );
}
