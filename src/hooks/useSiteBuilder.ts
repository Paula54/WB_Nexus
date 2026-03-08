import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { WebsiteSection } from "@/types/nexus";

export interface SitePage {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  is_published: boolean;
  sort_order: number;
}

const DEFAULT_PAGES: Omit<SitePage, "id" | "project_id">[] = [
  { title: "Home", slug: "home", is_published: false, sort_order: 0 },
  { title: "Sobre Nós", slug: "sobre-nos", is_published: false, sort_order: 1 },
  { title: "Serviços", slug: "servicos", is_published: false, sort_order: 2 },
  { title: "Contactos", slug: "contactos", is_published: false, sort_order: 3 },
];

export function useSiteBuilder() {
  const { user } = useAuth();
  const [pages, setPages] = useState<SitePage[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [sections, setSections] = useState<WebsiteSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load or create project + pages
  useEffect(() => {
    if (!user) return;

    async function load() {
      setLoading(true);

      // Find or auto-create project
      let projId: string;
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
        projId = projectRow.id;
      } else {
        const { data: newProject, error: createErr } = await supabase
          .from("projects")
          .insert({ user_id: user!.id, name: "Meu Projeto", project_type: "marketing" })
          .select("id")
          .single();
        if (createErr || !newProject) {
          console.error("Error creating project:", createErr);
          setLoading(false);
          return;
        }
        projId = newProject.id;
      }

      setProjectId(projId);

      // Load pages from new pages table
      const { data: existingPages } = await supabase
        .from("pages")
        .select("*")
        .eq("project_id", projId)
        .order("sort_order", { ascending: true });

      let sitePages: SitePage[];

      if (existingPages && existingPages.length > 0) {
        // Deduplicate pages by slug (keep first occurrence)
        const seen = new Set<string>();
        sitePages = (existingPages as SitePage[]).filter((p) => {
          if (seen.has(p.slug)) return false;
          seen.add(p.slug);
          return true;
        });
      } else {
        // Create default pages
        const inserts = DEFAULT_PAGES.map((p) => ({
          ...p,
          project_id: projId,
          user_id: user!.id,
        }));

        const { data: created, error: insertErr } = await supabase
          .from("pages")
          .insert(inserts)
          .select();

        if (insertErr || !created) {
          console.error("Error creating default pages:", insertErr);
          setLoading(false);
          return;
        }
        sitePages = created as SitePage[];
      }

      setPages(sitePages);

      // Also migrate old landing_pages sections to the Home page if they exist
      const homePage = sitePages.find((p) => p.slug === "home") || sitePages[0];
      setCurrentPageId(homePage.id);

      // Check if home page already has sections via page_id
      const { data: homeSecRows } = await supabase
        .from("page_sections")
        .select("*")
        .eq("page_id", homePage.id)
        .order("sort_order", { ascending: true });

      if (homeSecRows && homeSecRows.length > 0) {
        setSections(
          homeSecRows.map((r: any) => ({
            id: r.id,
            type: r.type as WebsiteSection["type"],
            content: r.content as WebsiteSection["content"],
          }))
        );
      } else {
        // Try migrating from legacy landing_pages
        const { data: legacyPages } = await supabase
          .from("landing_pages")
          .select("id")
          .eq("project_id", projId)
          .limit(1);

        if (legacyPages && legacyPages.length > 0) {
          const { data: legacySections } = await supabase
            .from("page_sections")
            .select("*")
            .eq("landing_page_id", legacyPages[0].id)
            .is("page_id", null)
            .order("sort_order", { ascending: true });

          if (legacySections && legacySections.length > 0) {
            // Link legacy sections to the new home page
            const ids = legacySections.map((s: any) => s.id);
            await supabase
              .from("page_sections")
              .update({ page_id: homePage.id })
              .in("id", ids);

            setSections(
              legacySections.map((r: any) => ({
                id: r.id,
                type: r.type as WebsiteSection["type"],
                content: r.content as WebsiteSection["content"],
              }))
            );
          } else {
            setSections([]);
          }
        } else {
          // Seed defaults for Home
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

          // We need a landing_page_id - find or create one
          let landingPageId: string;
          const { data: lp } = await supabase
            .from("landing_pages")
            .select("id")
            .eq("project_id", projId)
            .limit(1)
            .maybeSingle();

          if (lp) {
            landingPageId = lp.id;
          } else {
            const { data: newLp } = await supabase
              .from("landing_pages")
              .insert({ project_id: projId, user_id: user!.id, name: "Site", slug: "index" })
              .select("id")
              .single();
            landingPageId = newLp!.id;
          }

          const inserts = defaults.map((s, i) => ({
            id: s.id,
            landing_page_id: landingPageId,
            page_id: homePage.id,
            user_id: user!.id,
            type: s.type,
            sort_order: i,
            content: s.content,
          }));

          await supabase.from("page_sections").insert(inserts);
          setSections(defaults);
        }
      }

      setLoading(false);
    }

    load();
  }, [user]);

  // Load sections when page changes
  const loadPageSections = useCallback(
    async (pageId: string) => {
      if (!user) return;
      setCurrentPageId(pageId);

      const { data: rows } = await supabase
        .from("page_sections")
        .select("*")
        .eq("page_id", pageId)
        .order("sort_order", { ascending: true });

      if (rows && rows.length > 0) {
        setSections(
          rows.map((r: any) => ({
            id: r.id,
            type: r.type as WebsiteSection["type"],
            content: r.content as WebsiteSection["content"],
          }))
        );
      } else {
        setSections([]);
      }
    },
    [user]
  );

  // Auto-save with debounce
  const persistSections = useCallback(
    (updatedSections: WebsiteSection[]) => {
      if (!currentPageId || !user || !projectId) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          // We need a landing_page_id for the page_sections table
          let landingPageId: string;
          const { data: lp } = await supabase
            .from("landing_pages")
            .select("id")
            .eq("project_id", projectId)
            .limit(1)
            .maybeSingle();

          if (lp) {
            landingPageId = lp.id;
          } else {
            const { data: newLp } = await supabase
              .from("landing_pages")
              .insert({ project_id: projectId, user_id: user.id, name: "Site", slug: "index" })
              .select("id")
              .single();
            landingPageId = newLp!.id;
          }

          // Delete removed sections for this page
          const currentIds = updatedSections.map((s) => s.id);

          if (currentIds.length > 0) {
            const { error: deleteError } = await supabase
              .from("page_sections")
              .delete()
              .eq("page_id", currentPageId)
              .not("id", "in", `(${currentIds.join(",")})`);
            if (deleteError) throw deleteError;
          } else {
            // Delete all sections for this page
            await supabase.from("page_sections").delete().eq("page_id", currentPageId);
          }

          // Upsert sections
          if (updatedSections.length > 0) {
            const rows = updatedSections.map((s, i) => ({
              id: s.id,
              landing_page_id: landingPageId,
              page_id: currentPageId,
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
    [currentPageId, user, projectId]
  );

  const updateSections = useCallback(
    (newSections: WebsiteSection[]) => {
      setSections(newSections);
      persistSections(newSections);
    },
    [persistSections]
  );

  // Add a new page
  const addPage = useCallback(
    async (title: string, slug: string) => {
      if (!user || !projectId) return;

      const { data, error } = await supabase
        .from("pages")
        .insert({
          project_id: projectId,
          user_id: user.id,
          title,
          slug,
          sort_order: pages.length,
        })
        .select()
        .single();

      if (error) {
        toast.error("Erro ao criar página: " + error.message);
        return;
      }

      setPages((prev) => [...prev, data as SitePage]);
      toast.success(`Página "${title}" criada`);
      return data as SitePage;
    },
    [user, projectId, pages.length]
  );

  // Delete a page
  const deletePage = useCallback(
    async (pageId: string) => {
      if (pages.length <= 1) {
        toast.error("Não é possível eliminar a última página");
        return;
      }

      const { error } = await supabase.from("pages").delete().eq("id", pageId);
      if (error) {
        toast.error("Erro ao eliminar página");
        return;
      }

      setPages((prev) => prev.filter((p) => p.id !== pageId));
      if (currentPageId === pageId) {
        const remaining = pages.filter((p) => p.id !== pageId);
        if (remaining.length > 0) {
          loadPageSections(remaining[0].id);
        }
      }
      toast.success("Página eliminada");
    },
    [pages, currentPageId, loadPageSections]
  );

  return {
    pages,
    currentPageId,
    sections,
    updateSections,
    loading,
    saving,
    loadPageSections,
    addPage,
    deletePage,
  };
}
