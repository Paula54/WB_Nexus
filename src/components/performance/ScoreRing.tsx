import React from "react";

interface ScoreRingProps {
  score: number;
  label: string;
  size?: number;
}

function getColor(score: number): string {
  if (score >= 90) return "hsl(var(--chart-2))"; // green
  if (score >= 50) return "hsl(var(--chart-4))"; // orange
  return "hsl(var(--destructive))"; // red
}

export function ScoreRing({ score, label, size = 120 }: ScoreRingProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{score}</span>
        </div>
      </div>
      <span className="text-sm font-medium text-muted-foreground text-center">{label}</span>
    </div>
  );
}
