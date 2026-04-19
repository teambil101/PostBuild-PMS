import { useEffect, useRef } from "react";
import L from "leaflet";

interface Marker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  ref_code: string;
}

export function PortfolioMap({ markers }: { markers: Marker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center: markers.length ? [markers[0].lat, markers[0].lng] : [40.7128, -74.006],
      zoom: markers.length === 1 ? 13 : 5,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    const goldIcon = L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;background:hsl(36,36%,62%);border:2px solid hsl(30,8%,17%);border-radius:50%;box-shadow:0 0 0 3px hsla(36,36%,62%,0.3);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    const bounds: L.LatLngTuple[] = [];
    markers.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: goldIcon }).addTo(map);
      marker.bindPopup(
        `<div style="font-family:'Cormorant Garamond',serif;font-size:16px;color:#2E2C29;margin-bottom:2px;">${m.name}</div>
         <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#645D52;">${m.ref_code}</div>
         <a href="/properties/${m.id}" style="display:inline-block;margin-top:6px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#C3A575;text-decoration:none;">Open →</a>`,
      );
      bounds.push([m.lat, m.lng]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [markers]);

  if (markers.length === 0) {
    return (
      <div className="border hairline rounded-sm h-[480px] flex items-center justify-center bg-muted/30">
        <div className="text-center max-w-sm">
          <div className="label-eyebrow">No coordinates</div>
          <p className="text-sm text-muted-foreground mt-2">
            Add latitude and longitude to your buildings to see them on the portfolio map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="border hairline rounded-sm h-[560px] w-full overflow-hidden bg-muted/20" />
  );
}
