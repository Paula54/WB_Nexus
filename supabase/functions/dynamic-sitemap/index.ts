import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GET /functions/v1/dynamic-sitemap?projectId=...
 * Devolve XML sitemap com todas as pages publicadas + blog posts publicados.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) {
      return new Response("projectId required", { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: project } = await admin
      .from("projects")
      .select("id, user_id, domain")
      .eq("id", projectId)
      .maybeSingle();

    if (!project?.domain) {
      return new Response("Project sem domínio", { status: 404, headers: corsHeaders });
    }

    const base = project.domain.replace(/\/+$/, "");

    const { data: pages } = await admin
      .from("pages")
      .select("slug, updated_at")
      .eq("project_id", projectId)
      .eq("is_published", true);

    const { data: posts } = await admin
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("author_id", project.user_id)
      .eq("status", "published");

    const urls: Array<{ loc: string; lastmod: string; priority: string }> = [
      { loc: `${base}/`, lastmod: new Date().toISOString(), priority: "1.0" },
    ];

    (pages ?? []).forEach((p) => {
      if (p.slug && p.slug !== "index") {
        urls.push({
          loc: `${base}/${p.slug}`,
          lastmod: new Date(p.updated_at).toISOString(),
          priority: "0.8",
        });
      }
    });

    (posts ?? []).forEach((p) => {
      urls.push({
        loc: `${base}/blog/${p.slug}`,
        lastmod: new Date(p.updated_at).toISOString(),
        priority: "0.6",
      });
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[dynamic-sitemap] error:", e);
    return new Response("Erro interno", { status: 500, headers: corsHeaders });
  }
});
