import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { WebsiteSection } from "@/types/nexus";

interface LandingPage {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  is_published: boolean;
}

export function useSiteBuilder() {
  const { user } = useAuth();
  const [landingPage, setLandingPage] = useState<LandingPage | null>(null);
  const [sections, setSections] = useState<WebsiteSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load or create landing page + sections
  useEffect(() => {
    if (!user) return;

    async function load() {
      setLoading(true);

      // Find or auto-create project for this user
      let projectId: string;

      const { data: projectRow, error: projErr } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (projErr) {
        console.error("Error fetching project:", projErr);
        setLoading(false);
        return;
      }

      if (projectRow) {
        projectId = projectRow.id;
        console.log("[SiteBuilder] Projeto encontrado:", projectId);
      } else {
        // Auto-create a default project
        const { data: newProject, error: createErr } = await supabase
          .from("projects")
          .insert({
            user_id: user!.id,
            name: "Meu Projeto",
            project_type: "marketing",
          })
          .select("id")
          .single();

        if (createErr || !newProject) {
          console.error("Error creating project:", createErr);
          setLoading(false);
          return;
        }
        projectId = newProject.id;
        console.log("[SiteBuilder] Projeto criado automaticamente:", projectId);
      }

      // Try to find existing landing page
      const { data: pages } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("project_id", projectId)
        .limit(1);

      let page = pages?.[0] as LandingPage | undefined;

      // Create default if none exists
      if (!page) {
          const { data: newPage, error } = await supabase
            .from("landing_pages")
            .insert({
              project_id: projectId,
              user_id: user!.id,
              name: "Página Principal",
              slug: "index",
            })
          .select()
          .single();

        if (error) {
          console.error("Error creating landing page:", error);
          setLoading(false);
          return;
        }
        page = newPage as LandingPage;
      }

      setLandingPage(page);

      // Load sections
      const { data: sectionRows } = await supabase
        .from("page_sections")
        .select("*")
        .eq("landing_page_id", page.id)
        .order("sort_order", { ascending: true });

      if (sectionRows && sectionRows.length > 0) {
        setSections(
          sectionRows.map((r: any) => ({
            id: r.id,
            type: r.type as WebsiteSection["type"],
            content: r.content as WebsiteSection["content"],
          }))
        );
      } else {
        // Seed default sections
        const defaults: WebsiteSection[] = [
          {
            id: crypto.randomUUID(),
            type: "hero",
            content: {
              title: "Bem-vindo ao Seu Negócio",
              subtitle: "Transforme a sua presença digital com soluções inovadoras",
              buttonText: "Começar Agora",
              backgroundImage: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920",
            },
          },
          {
            id: crypto.randomUUID(),
            type: "features",
            content: {
              title: "As Nossas Funcionalidades",
              items: [
                { title: "Rapidez", desc: "Sites ultra-rápidos otimizados para performance" },
                { title: "Segurança", desc: "Proteção de dados de última geração" },
                { title: "Suporte 24/7", desc: "Equipa sempre disponível para ajudar" },
              ],
            },
          },
        ];

        // Persist defaults
        const inserts = defaults.map((s, i) => ({
          id: s.id,
          landing_page_id: page!.id,
          user_id: user!.id,
          type: s.type,
          sort_order: i,
          content: s.content,
        }));

        const { error: insertErr } = await supabase.from("page_sections").insert(inserts);
        if (insertErr) {
          console.error("[SiteBuilder] Erro ao gravar secções iniciais:", insertErr);
        } else {
          console.log("[SiteBuilder] ✅ Secções iniciais gravadas com sucesso:", inserts.length, "secções");
        }
        setSections(defaults);
      }

      setLoading(false);
    }

    load();
  }, [user]);

  // Auto-save with debounce
  const persistSections = useCallback(
    (updatedSections: WebsiteSection[]) => {
      if (!landingPage || !user) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          // Remove sections that were deleted
          const currentIds = updatedSections.map((s) => s.id);
          const { error: deleteError } = await supabase
            .from("page_sections")
            .delete()
            .eq("landing_page_id", landingPage.id)
            .not("id", "in", `(${currentIds.join(",")})`);

          if (deleteError) throw deleteError;

          // Upsert remaining sections
          if (updatedSections.length > 0) {
            const rows = updatedSections.map((s, i) => ({
              id: s.id,
              landing_page_id: landingPage.id,
              user_id: user.id,
              type: s.type,
              sort_order: i,
              content: s.content,
            }));

            const { error } = await supabase
              .from("page_sections")
              .upsert(rows, { onConflict: "id" });
            if (error) throw error;
          }
        } catch (err) {
          console.error("Error saving sections:", err);
          toast.error("Erro ao guardar secções");
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [landingPage, user]
  );

  const updateSections = useCallback(
    (newSections: WebsiteSection[]) => {
      setSections(newSections);
      persistSections(newSections);
    },
    [persistSections]
  );

  return { landingPage, sections, updateSections, loading, saving };
}
