import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ROWS = 1000;

const STANDARD_FIELDS = [
  { key: "name", label: "Nome", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefone" },
  { key: "company", label: "Empresa" },
  { key: "value", label: "Valor (€)" },
  { key: "priority", label: "Prioridade (low/medium/high)" },
  { key: "source", label: "Fonte" },
  { key: "notes", label: "Notas" },
  { key: "tags", label: "Tags (separadas por vírgula)" },
] as const;

const IGNORE = "__ignore__";
const CUSTOM = "__custom__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type Step = "upload" | "mapping" | "importing" | "summary";

export function LeadImportDialog({ open, onOpenChange, onImported }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState({ success: 0, errors: 0, errorList: [] as string[] });

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setProgress(0);
    setSummary({ success: 0, errors: 0, errorList: [] });
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast({ variant: "destructive", title: "Ficheiro demasiado grande", description: "Limite de 2MB." });
      return;
    }

    try {
      let parsedRows: Record<string, unknown>[] = [];
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "csv") {
        const text = await file.text();
        const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
        parsedRows = result.data;
      } else if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        parsedRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else {
        toast({ variant: "destructive", title: "Formato inválido", description: "Usa CSV, XLS ou XLSX." });
        return;
      }

      if (parsedRows.length === 0) {
        toast({ variant: "destructive", title: "Ficheiro vazio" });
        return;
      }

      if (parsedRows.length > MAX_ROWS) {
        toast({ variant: "destructive", title: "Demasiadas linhas", description: `Máximo ${MAX_ROWS} linhas por upload.` });
        return;
      }

      const cols = Object.keys(parsedRows[0]);
      setHeaders(cols);
      setRows(parsedRows);

      // Auto-mapping heurístico
      const auto: Record<string, string> = {};
      cols.forEach((col) => {
        const lower = col.toLowerCase().trim();
        const match = STANDARD_FIELDS.find((f) =>
          lower.includes(f.key) ||
          lower.includes(f.label.toLowerCase().split(" ")[0])
        );
        auto[col] = match ? match.key : CUSTOM;
      });
      setMapping(auto);
      setStep("mapping");
    } catch (err) {
      console.error("[Import] Parse error:", err);
      toast({ variant: "destructive", title: "Erro ao ler ficheiro" });
    }
  }, []);

  const runImport = async () => {
    if (!user) return;

    // Validar nome obrigatório
    const nameMapped = Object.values(mapping).includes("name");
    if (!nameMapped) {
      toast({ variant: "destructive", title: "Mapeamento incompleto", description: "Mapeia uma coluna ao campo Nome." });
      return;
    }

    setStep("importing");
    setProgress(0);

    let success = 0;
    let errors = 0;
    const errorList: string[] = [];
    const total = rows.length;
    const BATCH = 50;

    for (let i = 0; i < total; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const records = slice.map((row) => {
        const lead: Record<string, unknown> = { user_id: user.id, custom_fields: {} as Record<string, unknown> };
        const customFields: Record<string, unknown> = {};

        for (const [col, target] of Object.entries(mapping)) {
          const raw = row[col];
          if (raw === undefined || raw === null || raw === "") continue;
          const value = String(raw).trim();

          if (target === IGNORE) continue;
          if (target === CUSTOM) {
            customFields[col] = value;
            continue;
          }
          if (target === "value") {
            const num = parseFloat(value.replace(",", "."));
            if (!isNaN(num)) lead.value = num;
          } else if (target === "tags") {
            lead.tags = value.split(",").map((t) => t.trim()).filter(Boolean);
          } else if (target === "priority") {
            const p = value.toLowerCase();
            lead.priority = ["low", "medium", "high"].includes(p) ? p : "medium";
          } else {
            lead[target] = value;
          }
        }

        lead.custom_fields = customFields;
        return lead;
      }).filter((l) => l.name);

      if (records.length === 0) {
        errors += slice.length;
        continue;
      }

      const { error, count } = await supabase
        .from("leads")
        .insert(records as never, { count: "exact" });

      if (error) {
        errors += records.length;
        if (errorList.length < 5) errorList.push(error.message);
        console.error("[Import] Batch error:", error);
      } else {
        success += count ?? records.length;
      }

      setProgress(Math.round(((i + slice.length) / total) * 100));
    }

    setSummary({ success, errors, errorList });
    setStep("summary");
    if (success > 0) onImported();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Potenciais Clientes</DialogTitle>
          <DialogDescription>
            Carrega um ficheiro CSV ou Excel (máx. 2MB, 1000 linhas).
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-12 cursor-pointer hover:border-primary transition-colors">
            <Upload className="h-12 w-12 text-muted-foreground mb-3" />
            <span className="font-medium">Clica para escolher um ficheiro</span>
            <span className="text-xs text-muted-foreground mt-1">CSV, XLS ou XLSX</span>
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              {rows.length} linhas detetadas. Associa as colunas:
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
              {headers.map((col) => (
                <div key={col} className="grid grid-cols-2 gap-3 items-center">
                  <Label className="truncate text-sm">{col}</Label>
                  <Select value={mapping[col] ?? CUSTOM} onValueChange={(v) => setMapping((m) => ({ ...m, [col]: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}{f.required ? " *" : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM}>Guardar em custom_fields</SelectItem>
                      <SelectItem value={IGNORE}>Ignorar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={runImport}>Importar {rows.length} leads</Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 py-6">
            <p className="text-sm text-center text-muted-foreground">A importar... {progress}%</p>
            <Progress value={progress} />
          </div>
        )}

        {step === "summary" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div>
                <p className="font-semibold">{summary.success} leads importados com sucesso</p>
              </div>
            </div>
            {summary.errors > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-6 w-6 text-red-500 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">{summary.errors} erros</p>
                  {summary.errorList.map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{e}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
