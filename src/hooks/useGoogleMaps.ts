import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cachedPromise: Promise<void> | null = null;
let cachedKey: string | null = null;

async function loadKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const { data, error } = await supabase.functions.invoke("google-maps-key");
  if (error || !data?.key) throw new Error(error?.message ?? "Failed to load Maps key");
  cachedKey = data.key as string;
  return cachedKey;
}

function loadScript(key: string): Promise<void> {
  if (cachedPromise) return cachedPromise;
  if ((window as any).google?.maps?.places) {
    cachedPromise = Promise.resolve();
    return cachedPromise;
  }
  cachedPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps")));
      return;
    }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`;
    s.async = true;
    s.defer = true;
    s.dataset.googleMaps = "true";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return cachedPromise;
}

export function useGoogleMaps() {
  const [ready, setReady] = useState<boolean>(
    !!(typeof window !== "undefined" && (window as any).google?.maps?.places),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;
    let active = true;
    (async () => {
      try {
        const key = await loadKey();
        await loadScript(key);
        if (active) setReady(true);
      } catch (e: any) {
        if (active) setError(e?.message ?? "Failed to load Google Maps");
      }
    })();
    return () => {
      active = false;
    };
  }, [ready]);

  return { ready, error };
}
