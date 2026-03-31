import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import { Check, FileText } from "lucide-react";

interface Asset {
  id: string;
  file_name: string;
  file_type: string;
  mime_type: string | null;
  public_url: string | null;
}

interface AssetPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  filterType?: string;
}

export default function AssetPickerModal({ open, onClose, onSelect, filterType }: AssetPickerModalProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    (async () => {
      let query = supabase
        .from("assets" as string)
        .select("id, file_name, file_type, mime_type, public_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (filterType) query = query.eq("file_type", filterType);
      const { data } = await query;
      setAssets((data as Asset[]) || []);
      setLoading(false);
    })();
  }, [open, user, filterType]);

  function handleConfirm() {
    if (selected) {
      onSelect(selected);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Selecionar da Biblioteca</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground text-sm">A carregar ficheiros...</div>
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum ficheiro encontrado. Carrega um primeiro na Biblioteca Multimédia.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {assets.map((asset) => {
              const isImage = asset.mime_type?.startsWith("image/");
              const isSelected = selected === asset.public_url;
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelected(asset.public_url)}
                  className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${
                    isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                  }`}
                >
                  {isImage && asset.public_url ? (
                    <img src={asset.public_url} alt={asset.file_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 p-2">
                      <FileText className="h-8 w-8 text-muted-foreground/40 mb-1" />
                      <span className="text-[10px] text-muted-foreground truncate w-full text-center">{asset.file_name}</span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected}>Usar este ficheiro</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
