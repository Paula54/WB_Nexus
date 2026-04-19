import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/imageCompression";
import { Upload, Trash2, Image, FileText, Loader2, ImagePlus } from "lucide-react";

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
  { value: "logo", label: "Logótipo", bucket: "logos" },
  { value: "product_image", label: "Imagem de Produto", bucket: "products" },
  { value: "document", label: "Documento", bucket: "documents" },
  { value: "other", label: "Outro", bucket: "others" },
];

function getBucketForType(fileType: string): string {
  return FILE_TYPE_OPTIONS.find((o) => o.value === fileType)?.bucket || "others";
}

// Map file_type → projects column (DNA centralizado)
const TYPE_TO_COLUMN: Record<string, string> = {
  logo: "logo_url",
};

export default function AssetLibraryTab() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  async function syncBusinessProfile(fileType: string, publicUrl: string) {
    if (!user) return;
    const column = TYPE_TO_COLUMN[fileType];
    if (!column) return;

    try {
      // Centralized DNA lives in `projects` — update the user's primary project.
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (project?.id) {
        await supabase
          .from("projects")
          .update({ [column]: publicUrl } as never)
          .eq("id", project.id);
      } else {
        // Create a minimal primary project so the asset has somewhere to attach
        await supabase
          .from("projects")
          .insert({ user_id: user.id, name: "Meu Negócio", [column]: publicUrl } as never);
      }
    } catch (err) {
      console.warn("[AssetLibrary] Sync to projects skipped:", err);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files?.length) return;
    let file = e.target.files[0];

    setUploading(true);
    setUploadProgress(0);

    // Compress images automatically (skip SVGs / PDFs)
    if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
      try {
        setUploadProgress(5);
        file = await compressImage(
          file,
          selectedType as "logo" | "product_image" | "other",
          (p) => setUploadProgress(Math.min(p * 0.5, 45))
        );
      } catch (err) {
        console.warn("[AssetLibrary] Compression failed, using original:", err);
      }
    }

    // After compression, enforce 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Ficheiro demasiado grande", description: "Máximo 5MB após compressão." });
      setUploading(false);
      setUploadProgress(0);
      return;
    }

    setUploadProgress(50);
    const bucket = getBucketForType(selectedType);
    const ext = file.name.split(".").pop() || "bin";
    const filePath = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ variant: "destructive", title: "Erro no upload", description: uploadError.message });
      setUploading(false);
      setUploadProgress(0);
      return;
    }

    setUploadProgress(75);
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // Save metadata to assets table
    try {
      const insertPayload = {
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_type: selectedType,
        mime_type: file.type,
        file_size: file.size,
        public_url: publicUrl,
      };

      const { error: dbError } = await supabase
        .from("assets" as string)
        .insert(insertPayload as Record<string, unknown>);

      if (dbError) {
        console.error("[AssetLibrary] DB insert error:", JSON.stringify(dbError));
        toast({ variant: "destructive", title: "Metadados falharam", description: `${dbError.message} (${dbError.code})` });
      } else {
        setUploadProgress(90);
        // Sync to projects (DNA centralizado) if applicable
        await syncBusinessProfile(selectedType, publicUrl);
        setUploadProgress(100);
        toast({ title: "Ficheiro carregado ✅", description: `${file.name} adicionado à biblioteca.` });
        fetchAssets();
      }
    } catch (err: unknown) {
      console.error("[AssetLibrary] Unexpected error:", err);
      toast({ variant: "destructive", title: "Erro inesperado", description: String(err) });
    }

    setUploading(false);
    setTimeout(() => setUploadProgress(0), 1000);
    e.target.value = "";
  }

  async function handleDelete(asset: Asset) {
    const bucket = getBucketForType(asset.file_type);
    await supabase.storage.from(bucket).remove([asset.file_path]);
    await supabase.from("assets" as string).delete().eq("id", asset.id);

    // Clear from projects (DNA centralizado) if applicable
    const column = TYPE_TO_COLUMN[asset.file_type];
    if (column && user) {
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (project?.id) {
        await supabase
          .from("projects")
          .update({ [column]: null } as never)
          .eq("id", project.id);
      }
    }

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
            <ImagePlus className="h-5 w-5 text-primary" />
            Nexus Media Engine
          </CardTitle>
          <CardDescription>Carrega ficheiros com compressão automática. Imagens são otimizadas para WebP.</CardDescription>
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">
                        {uploadProgress < 50 ? "A comprimir..." : uploadProgress < 90 ? "A carregar..." : "A finalizar..."}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-primary/50" />
                    <p className="text-sm">Clica ou arrasta um ficheiro</p>
                    <p className="text-xs mt-1">Imagens são automaticamente comprimidas e convertidas para WebP</p>
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

      {/* Asset grid with thumbnails */}
      {assets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum ficheiro carregado ainda</p>
          <p className="text-xs mt-1">Carrega o teu logótipo para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="glass overflow-hidden group">
              <div className="aspect-square bg-muted/50 flex items-center justify-center overflow-hidden">
                {asset.mime_type?.startsWith("image/") && asset.public_url ? (
                  <img
                    src={asset.public_url}
                    alt={asset.file_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <FileText className="h-12 w-12 text-muted-foreground/30" />
                )}
              </div>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" title={asset.file_name}>{asset.file_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {FILE_TYPE_OPTIONS.find((o) => o.value === asset.file_type)?.label || asset.file_type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{formatSize(asset.file_size)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => handleDelete(asset)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
