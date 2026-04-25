import { useEffect } from "react";
import { useProjectData } from "@/hooks/useProjectData";

export function GoogleAnalytics() {
  const { project } = useProjectData();
  const gaId = project?.google_analytics_id ?? null;
  const gtmId = project?.gtm_container_id ?? null;

  // Inject GTM (preferred when available — GTM loads GA4 via configured tag)
  useEffect(() => {
    if (!gtmId || !/^GTM-[A-Z0-9]+$/i.test(gtmId)) return;

    if (document.querySelector(`script[data-gtm="${gtmId}"]`)) return;

    const inline = document.createElement("script");
    inline.setAttribute("data-gtm", gtmId);
    inline.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${gtmId}');
    `;
    document.head.appendChild(inline);

    // noscript iframe fallback in body
    const noscript = document.createElement("noscript");
    noscript.setAttribute("data-gtm", gtmId);
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.insertBefore(noscript, document.body.firstChild);

    return () => {
      inline.remove();
      noscript.remove();
    };
  }, [gtmId]);

  // Fallback: inject gtag.js directly only if GTM is NOT configured
  useEffect(() => {
    if (gtmId) return; // GTM handles GA4 already
    if (!gaId || !/^G-[A-Z0-9]+$/i.test(gaId)) return;

    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${gaId}"]`)) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    const inlineScript = document.createElement("script");
    inlineScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}');
    `;
    document.head.appendChild(inlineScript);

    return () => {
      script.remove();
      inlineScript.remove();
    };
  }, [gaId, gtmId]);

  return null;
}
