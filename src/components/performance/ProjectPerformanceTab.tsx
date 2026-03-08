import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "./ScoreRing";
import { Gauge, Wand2, FileDown, History, Save, Pencil } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface Props {
  projectId: string;
  projectName: string;
}

interface Scan {
  id: string;
  performance_score: number;
  accessibility_score: number;
  best_practices_score: number;
  seo_score: number;
  notes: string | null;
  scan_type: string;
  created_at: string;
}

export function ProjectPerformanceTab({ projectId, projectName }: Props) {
  const { user } = useAuth();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [scores, setScores] = useState({
    performance: 0,
    accessibility: 0,
    bestPractices: 0,
    seo: 0,
  });
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchScans();
  }, [projectId]);

  async function fetchScans() {
    const { data } = await supabase
      .from("performance_scans" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (data) {
      const typed = data as unknown as Scan[];
      setScans(typed);
      if (typed.length > 0) {
        const latest = typed[0];
        setScores({
          performance: latest.performance_score,
          accessibility: latest.accessibility_score,
          bestPractices: latest.best_practices_score,
          seo: latest.seo_score,
        });
        setNotes(latest.notes || "");
      }
    }
    setLoading(false);
  }

  function simulateScan() {
    const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const newScores = {
      performance: rand(55, 99),
      accessibility: rand(70, 100),
      bestPractices: rand(60, 100),
      seo: rand(65, 98),
    };
    setScores(newScores);
    setEditing(true);
    toast.success("Scan simulado com sucesso!");
  }

  async function saveScan() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("performance_scans" as any).insert({
      project_id: projectId,
      scanned_by: user.id,
      performance_score: scores.performance,
      accessibility_score: scores.accessibility,
      best_practices_score: scores.bestPractices,
      seo_score: scores.seo,
      notes: notes || null,
      scan_type: "manual",
    } as any);

    if (error) {
      toast.error("Erro ao guardar scan");
      console.error(error);
    } else {
      toast.success("Resultados guardados!");
      setEditing(false);
      fetchScans();
    }
    setSaving(false);
  }

  function generatePDF() {
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, w, 50, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Relatório de Performance", w / 2, 25, { align: "center" });
    doc.setFontSize(12);
    doc.text(projectName, w / 2, 35, { align: "center" });
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString("pt-PT"), w / 2, 43, { align: "center" });

    // Scores
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.text("Resultados do Scan", 20, 68);

    const labels = ["Performance", "Acessibilidade", "Melhores Práticas", "SEO"];
    const values = [scores.performance, scores.accessibility, scores.bestPractices, scores.seo];

    labels.forEach((label, i) => {
      const y = 80 + i * 22;
      const score = values[i];

      // Score bar background
      doc.setFillColor(230, 230, 235);
      doc.roundedRect(20, y, 130, 12, 3, 3, "F");

      // Score bar fill
      const color = score >= 90 ? [34, 197, 94] : score >= 50 ? [251, 146, 60] : [239, 68, 68];
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(20, y, (score / 100) * 130, 12, 3, 3, "F");

      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      doc.text(label, 22, y + 8.5);
      doc.setFontSize(13);
      doc.text(`${score}`, 158, y + 9);
    });

    // Notes
    if (notes) {
      doc.setFontSize(14);
      doc.text("Notas", 20, 175);
      doc.setFontSize(10);
      const splitNotes = doc.splitTextToSize(notes, 170);
      doc.text(splitNotes, 20, 185);
    }

    // Footer
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Gerado por Nexus Machine · web-business.pt", w / 2, h - 10, { align: "center" });

    doc.save(`performance-${projectName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    toast.success("PDF gerado com sucesso!");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score Rings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gauge className="w-5 h-5 text-primary" />
            Scores Atuais
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={simulateScan}>
              <Wand2 className="w-4 h-4 mr-1" /> Simular Scan
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4 mr-1" /> Editar Manual
            </Button>
            <Button size="sm" variant="default" onClick={generatePDF} disabled={scores.performance === 0}>
              <FileDown className="w-4 h-4 mr-1" /> Gerar Relatório PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 justify-items-center">
            <ScoreRing score={scores.performance} label="Performance" />
            <ScoreRing score={scores.accessibility} label="Acessibilidade" />
            <ScoreRing score={scores.bestPractices} label="Melhores Práticas" />
            <ScoreRing score={scores.seo} label="SEO" />
          </div>

          {/* Manual Input */}
          {editing && (
            <div className="mt-6 space-y-4 border-t border-border pt-4">
              <p className="text-sm font-medium text-muted-foreground">Inserir valores manualmente:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {([
                  ["performance", "Performance"],
                  ["accessibility", "Acessibilidade"],
                  ["bestPractices", "Melhores Práticas"],
                  ["seo", "SEO"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={scores[key]}
                      onChange={(e) =>
                        setScores((s) => ({
                          ...s,
                          [key]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <Textarea
                placeholder="Notas sobre o scan (opcional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveScan} disabled={saving}>
                  <Save className="w-4 h-4 mr-1" /> Guardar Resultados
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {scans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5 text-muted-foreground" />
              Histórico de Scans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      {new Date(scan.created_at).toLocaleDateString("pt-PT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {scan.scan_type === "manual" ? "Manual" : "Simulado"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <span title="Performance" className={scan.performance_score >= 90 ? "text-green-600" : scan.performance_score >= 50 ? "text-orange-500" : "text-destructive"}>
                      P:{scan.performance_score}
                    </span>
                    <span title="Acessibilidade" className={scan.accessibility_score >= 90 ? "text-green-600" : scan.accessibility_score >= 50 ? "text-orange-500" : "text-destructive"}>
                      A:{scan.accessibility_score}
                    </span>
                    <span title="Melhores Práticas" className={scan.best_practices_score >= 90 ? "text-green-600" : scan.best_practices_score >= 50 ? "text-orange-500" : "text-destructive"}>
                      MP:{scan.best_practices_score}
                    </span>
                    <span title="SEO" className={scan.seo_score >= 90 ? "text-green-600" : scan.seo_score >= 50 ? "text-orange-500" : "text-destructive"}>
                      S:{scan.seo_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
