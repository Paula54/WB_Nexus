import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const topic: string = (body.topic || "").toString().trim();
    const platform: string = (body.platform || "instagram").toString().toLowerCase();
    const generateImage: boolean = body.generate_image !== false;

    if (!topic || topic.length < 3) {
      return new Response(
        JSON.stringify({ error: "Indica um tema (mínimo 3 caracteres)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (topic.length > 500) {
      return new Response(
        JSON.stringify({ error: "Tema demasiado longo (máx 500 caracteres)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Pull business context for richer prompts
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_name, business_sector, ai_custom_instructions")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1);

    const ctx = profile?.[0] || {};
    const sector = (ctx as Record<string, string>).business_sector || "imobiliário";
    const company = (ctx as Record<string, string>).company_name || "";
    const customInstr = (ctx as Record<string, string>).ai_custom_instructions || "";

    // ===== 1) Generate caption + hashtags via GPT-4o =====
    const systemPrompt = `És um especialista em marketing de redes sociais para o setor "${sector}" em Portugal.
Escreves em Português de Portugal (nunca brasileiro), com tom profissional, persuasivo e adequado à plataforma ${platform}.
${company ? `A empresa chama-se "${company}".` : ""}
${customInstr ? `Instruções extra do cliente: ${customInstr}` : ""}
Devolve SEMPRE JSON válido com a estrutura: { "caption": string, "hashtags": string[], "image_prompt": string }
- caption: legenda final pronta a publicar (máx 2200 chars), com emojis quando fizer sentido
- hashtags: 8 a 12 hashtags relevantes em PT, sem o símbolo #
- image_prompt: descrição em INGLÊS, fotorrealista, profissional, focada no setor do cliente, sem texto na imagem`;

    const chatRes = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Cria um post de ${platform} sobre: ${topic}` },
        ],
      }),
    });

    if (!chatRes.ok) {
      const errTxt = await chatRes.text();
      console.error("[generate-social-content] OpenAI chat error:", chatRes.status, errTxt);
      if (chatRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de pedidos OpenAI atingido. Tenta novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Falha ao gerar conteúdo." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatJson = await chatRes.json();
    let parsed: { caption?: string; hashtags?: string[]; image_prompt?: string } = {};
    try {
      parsed = JSON.parse(chatJson.choices?.[0]?.message?.content ?? "{}");
    } catch {
      parsed = { caption: chatJson.choices?.[0]?.message?.content ?? "" };
    }

    const caption = (parsed.caption || "").toString().trim();
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((h) => h.toString().replace(/^#/, "").trim()).filter(Boolean).slice(0, 12)
      : [];
    const imagePrompt = (parsed.image_prompt || `Professional ${sector} marketing image, high quality, photorealistic, no text`).toString();

    if (!caption) {
      return new Response(
        JSON.stringify({ error: "A IA não devolveu legenda. Tenta novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== 2) Generate image via DALL-E 3 =====
    let imageUrl: string | null = null;
    if (generateImage) {
      const imgRes = await fetch(OPENAI_IMAGE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: `${imagePrompt}. Style: professional ${sector} photography, high resolution, marketing-ready, no text overlays.`,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        }),
      });

      if (!imgRes.ok) {
        const errTxt = await imgRes.text();
        console.error("[generate-social-content] DALL-E error:", imgRes.status, errTxt);
        // Non-fatal: continue without image
      } else {
        const imgJson = await imgRes.json();
        const remoteUrl = imgJson?.data?.[0]?.url as string | undefined;

        if (remoteUrl) {
          // Download and persist to our storage so it doesn't expire
          try {
            const fetched = await fetch(remoteUrl);
            const buf = new Uint8Array(await fetched.arrayBuffer());
            const path = `${userId}/${crypto.randomUUID()}.png`;
            const { error: uploadErr } = await supabase.storage
              .from("social-images")
              .upload(path, buf, { contentType: "image/png", upsert: false });
            if (uploadErr) {
              console.error("[generate-social-content] storage upload error:", uploadErr);
              imageUrl = remoteUrl; // fallback to OpenAI temp URL
            } else {
              const { data: pub } = supabase.storage.from("social-images").getPublicUrl(path);
              imageUrl = pub.publicUrl;
            }
          } catch (e) {
            console.error("[generate-social-content] image persist error:", e);
            imageUrl = remoteUrl;
          }
        }
      }
    }

    // ===== 3) Persist as draft in social_posts =====
    const { data: inserted, error: insertErr } = await supabase
      .from("social_posts")
      .insert({
        user_id: userId,
        caption,
        hashtags,
        platform,
        image_url: imageUrl,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[generate-social-content] insert error:", insertErr);
      return new Response(
        JSON.stringify({ error: "Falha ao guardar o post gerado." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        post_id: inserted.id,
        caption,
        hashtags,
        image_url: imageUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-social-content] internal error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao gerar conteúdo." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
