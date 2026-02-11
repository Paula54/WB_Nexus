import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Upload, Trash2, Image, FileText, Loader2 } from "lucide-react";

interface Asset {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  mime_type: string | null;
  file_size: number | null;
  public_url: string | null;
  created_at: string;
}

const FILE_TYPE_OPTIONS = [
  { value: "logo", label: "Logótipo" },
  { value: "product_image", label: "Imagem de Produto" },
  { value: "document", label: "Documento" },
  { value: "other", label: "Outro" },
];

export default function AssetLibraryTab() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("logo");

  const fetchAssets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("assets" as string)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setAssets((data as Asset[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files?.length) return;
    const file = e.target.files[0];

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Ficheiro demasiado grande", description: "Máximo 5MB." });
      return;
    }

    setUploading(true);
    const filePath = `${user.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, file);

    if (uploadError) {
      toast({ variant: "destructive", title: "Erro no upload", description: uploadError.message });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(filePath);

    const { error: dbError } = await supabase.from("assets" as string).insert({
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      file_type: selectedType,
      mime_type: file.type,
      file_size: file.size,
      public_url: urlData.publicUrl,
    } as Record<string, unknown>);

    if (dbError) {
      toast({ variant: "destructive", title: "Erro", description: "Upload feito mas metadados falharam." });
    } else {
      toast({ title: "Ficheiro carregado ✅", description: `${file.name} adicionado à biblioteca.` });
      fetchAssets();
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleDelete(asset: Asset) {
    await supabase.storage.from("assets").remove([asset.file_path]);
    await supabase.from("assets" as string).delete().eq("id", asset.id);
    toast({ title: "Ficheiro removido", description: asset.file_name });
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return <div className="h-48 animate-pulse bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <Card className="glass border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5 text-primary" />
            Carregar Ficheiro
          </CardTitle>
          <CardDescription>Logótipos, imagens de produto ou documentos (máx. 5MB)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              {FILE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label className="flex-1">
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/60 transition-colors">
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>A carregar...</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-primary/50" />
                    <p className="text-sm">Clica ou arrasta um ficheiro</p>
                    <p className="text-xs mt-1">PNG, JPG, SVG, PDF — máx. 5MB</p>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*,.pdf,.svg"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Asset grid */}
      {assets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum ficheiro carregado ainda</p>
          <p className="text-xs mt-1">Carrega o teu logótipo para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="glass overflow-hidden group">
              <div className="aspect-video bg-muted/50 flex items-center justify-center overflow-hidden">
                {asset.mime_type?.startsWith("image/") && asset.public_url ? (
                  <img
                    src={asset.public_url}
                    alt={asset.file_name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <FileText className="h-12 w-12 text-muted-foreground/30" />
                )}
              </div>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{asset.file_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {FILE_TYPE_OPTIONS.find((o) => o.value === asset.file_type)?.label || asset.file_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatSize(asset.file_size)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(asset)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
