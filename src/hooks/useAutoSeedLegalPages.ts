import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseCustom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LEGAL_PAGE_LABELS,
  LEGAL_PAGE_TYPE_MAP,
  LegalPageKey,
  generateLegalTemplate,
  normalizeLegalBusinessData,
} from "@/lib/legalTemplates";

/**
 * Garante que o utilizador tem páginas legais (Privacidade, Termos, Cookies)
 * geradas a partir do Perfil da Empresa. Corre uma vez por sessão de Site Builder
 * e só CRIA as páginas em falta — nunca sobrescreve conteúdo já validado.
 */
export function useAutoSeedLegalPages(projectId: string | null) {
  const { user } = useAuth();
  const seededRef = useRef(false);

  useEffect(() => {
    if (!user || !projectId || seededRef.current) return;
    seededRef.current = true;

    (async () => {
      try {
        // 1) Quais páginas já existem?
        const wantedTypes = Object.values(LEGAL_PAGE_TYPE_MAP);
        const { data: existing } = await supabase
          .from("compliance_pages")
          .select("page_type")
          .eq("user_id", user.id)
          .eq("project_id", projectId)
          .in("page_type", wantedTypes);

        const existingSet = new Set((existing || []).map((r: any) => r.page_type as string));
        const missing = (Object.keys(LEGAL_PAGE_TYPE_MAP) as LegalPageKey[]).filter(
          (key) => !existingSet.has(LEGAL_PAGE_TYPE_MAP[key]),
        );
        if (missing.length === 0) return;

        // 2) Carregar dados do negócio
        const [bp, proj, prof] = await Promise.all([
          supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
          supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        ]);

        const data = normalizeLegalBusinessData(
          [
            (bp.data || {}) as Record<string, unknown>,
            (proj.data || {}) as Record<string, unknown>,
            (prof.data || {}) as Record<string, unknown>,
          ],
          user.email || "",
        );

        // 3) Inserir só as que faltam, com status 'pending' para o utilizador rever depois
        const rows = missing.map((key) => ({
          user_id: user.id,
          project_id: projectId,
          page_type: LEGAL_PAGE_TYPE_MAP[key],
          status: "pending",
          content: generateLegalTemplate(key, data),
          custom_fields: {
            title: LEGAL_PAGE_LABELS[key],
            auto_seeded: true,
            seeded_at: new Date().toISOString(),
          },
        }));

        await supabase.from("compliance_pages").insert(rows);
      } catch (e) {
        console.warn("[useAutoSeedLegalPages] skipped:", e);
      }
    })();
  }, [user, projectId]);
}
