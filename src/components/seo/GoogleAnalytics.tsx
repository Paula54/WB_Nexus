import { useEffect } from "react";
import { useProjectData } from "@/hooks/useProjectData";

export function GoogleAnalytics() {
  const { project } = useProjectData();
  const gaId = project?.google_analytics_id;

  useEffect(() => {
    if (!gaId || !/^G-[A-Z0-9]+$/i.test(gaId)) return;

    // Avoid duplicate injection
    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${gaId}"]`)) {
      return;
    }

    // Inject gtag.js script
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    // Inject config
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
  }, [gaId]);

  return null;
}
