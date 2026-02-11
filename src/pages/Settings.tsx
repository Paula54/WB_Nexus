import { Building2, FileText, Image, Palette } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BusinessProfileTab from "@/components/settings/BusinessProfileTab";
import LegalPagesTab from "@/components/settings/LegalPagesTab";
import AssetLibraryTab from "@/components/settings/AssetLibraryTab";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Palette className="h-8 w-8 text-primary" />
          Configurações da Empresa
        </h1>
        <p className="text-muted-foreground mt-1">
          Gere a identidade, documentos legais e multimédia do teu negócio
        </p>
      </div>

      <Tabs defaultValue="business" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Dados da Empresa</span>
            <span className="sm:hidden">Empresa</span>
          </TabsTrigger>
          <TabsTrigger value="legal" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos Legais</span>
            <span className="sm:hidden">Legal</span>
          </TabsTrigger>
          <TabsTrigger value="media" className="gap-2">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Biblioteca Multimédia</span>
            <span className="sm:hidden">Média</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <BusinessProfileTab />
        </TabsContent>

        <TabsContent value="legal">
          <LegalPagesTab />
        </TabsContent>

        <TabsContent value="media">
          <AssetLibraryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
