interface ProgressBarProps {
  progress: number;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const getColor = () => {
    if (progress >= 100) return "from-neon-green to-neon-blue";
    if (progress >= 66) return "from-neon-blue to-neon-purple";
    if (progress >= 33) return "from-neon-purple to-neon-blue";
    return "from-neon-purple/50 to-neon-blue/50";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">Progresso de Configuração</span>
        <span className="font-display font-bold text-foreground">{progress}%</span>
      </div>
      <div className="h-3 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getColor()} transition-all duration-1000 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {progress >= 100 && (
        <p className="text-sm text-neon-green font-medium text-center animate-pulse">
          🎉 Configuração completa! A tua máquina de vendas está pronta.
        </p>
      )}
    </div>
  );
}
