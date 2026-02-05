 import { useState, useRef } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Upload, Link, Loader2, X, Image as ImageIcon } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 import { cn } from "@/lib/utils";
 
 interface ImageUploadProps {
   value: string;
   onChange: (url: string) => void;
   disabled?: boolean;
 }
 
 export function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
   const [uploading, setUploading] = useState(false);
   const [urlInput, setUrlInput] = useState(value);
   const [activeTab, setActiveTab] = useState<string>(value ? "url" : "upload");
   const fileInputRef = useRef<HTMLInputElement>(null);
 
   const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
 
     // Validate file type
     if (!file.type.startsWith("image/")) {
       toast.error("Por favor, seleciona apenas ficheiros de imagem");
       return;
     }
 
     // Validate file size (max 5MB)
     if (file.size > 5 * 1024 * 1024) {
       toast.error("A imagem deve ter no máximo 5MB");
       return;
     }
 
     setUploading(true);
 
     try {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) {
         toast.error("Precisas de estar autenticado para fazer upload");
         return;
       }
 
       // Create unique filename
       const fileExt = file.name.split(".").pop();
       const fileName = `${user.id}/${Date.now()}.${fileExt}`;
 
       // Upload to Supabase Storage
       const { error: uploadError } = await supabase.storage
         .from("social-images")
         .upload(fileName, file, {
           cacheControl: "3600",
           upsert: false,
         });
 
       if (uploadError) {
         console.error("Upload error:", uploadError);
         toast.error("Erro ao fazer upload da imagem");
         return;
       }
 
       // Get public URL
       const { data: { publicUrl } } = supabase.storage
         .from("social-images")
         .getPublicUrl(fileName);
 
       onChange(publicUrl);
       setUrlInput(publicUrl);
       toast.success("Imagem carregada com sucesso!");
     } catch (error) {
       console.error("Upload error:", error);
       toast.error("Erro ao fazer upload da imagem");
     } finally {
       setUploading(false);
       // Reset file input
       if (fileInputRef.current) {
         fileInputRef.current.value = "";
       }
     }
   };
 
   const handleUrlChange = (url: string) => {
     setUrlInput(url);
   };
 
   const handleUrlBlur = () => {
     onChange(urlInput);
   };
 
   const handleUrlKeyDown = (e: React.KeyboardEvent) => {
     if (e.key === "Enter") {
       onChange(urlInput);
     }
   };
 
   const handleClear = () => {
     onChange("");
     setUrlInput("");
   };
 
   return (
     <div className="space-y-3">
       <Label className="flex items-center gap-2">
         <ImageIcon className="h-4 w-4" />
         Imagem do Post
       </Label>
 
       <Tabs value={activeTab} onValueChange={setActiveTab}>
         <TabsList className="grid w-full grid-cols-2">
           <TabsTrigger value="upload" className="flex items-center gap-2">
             <Upload className="h-4 w-4" />
             Upload
           </TabsTrigger>
           <TabsTrigger value="url" className="flex items-center gap-2">
             <Link className="h-4 w-4" />
             URL
           </TabsTrigger>
         </TabsList>
 
         <TabsContent value="upload" className="mt-3">
           <div
             className={cn(
               "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
               "hover:border-primary/50 hover:bg-muted/30",
               uploading && "opacity-50 pointer-events-none"
             )}
           >
             <input
               ref={fileInputRef}
               type="file"
               accept="image/*"
               onChange={handleFileSelect}
               className="hidden"
               disabled={disabled || uploading}
             />
             
             {uploading ? (
               <div className="flex flex-col items-center gap-2">
                 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                 <p className="text-sm text-muted-foreground">A carregar...</p>
               </div>
             ) : (
               <div className="flex flex-col items-center gap-2">
                 <Upload className="h-8 w-8 text-muted-foreground" />
                 <p className="text-sm text-muted-foreground">
                   Arrasta uma imagem ou
                 </p>
                 <Button
                   type="button"
                   variant="secondary"
                   size="sm"
                   onClick={() => fileInputRef.current?.click()}
                   disabled={disabled}
                 >
                   Escolher ficheiro
                 </Button>
                 <p className="text-xs text-muted-foreground mt-1">
                   PNG, JPG ou GIF (máx. 5MB)
                 </p>
               </div>
             )}
           </div>
         </TabsContent>
 
         <TabsContent value="url" className="mt-3">
           <Input
             placeholder="https://exemplo.com/imagem.jpg"
             value={urlInput}
             onChange={(e) => handleUrlChange(e.target.value)}
             onBlur={handleUrlBlur}
             onKeyDown={handleUrlKeyDown}
             disabled={disabled}
           />
         </TabsContent>
       </Tabs>
 
       {/* Image Preview */}
       {value && (
         <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30">
           <img
             src={value}
             alt="Preview"
             className="w-full h-40 object-cover"
             onError={(e) => {
               (e.target as HTMLImageElement).style.display = "none";
             }}
           />
           <Button
             type="button"
             variant="destructive"
             size="icon"
             className="absolute top-2 right-2 h-7 w-7"
             onClick={handleClear}
             disabled={disabled}
           >
             <X className="h-4 w-4" />
           </Button>
         </div>
       )}
     </div>
   );
 }