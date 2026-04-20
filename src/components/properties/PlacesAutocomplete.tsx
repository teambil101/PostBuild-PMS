import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { cn } from "@/lib/utils";

export interface PlaceResult {
  address_formatted: string;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  city: string | null;
  country: string | null; // ISO-2 uppercase
  community: string | null;
}

interface Props {
  id?: string;
  value: string;
  onChange: (text: string) => void;
  onPlaceSelected: (place: PlaceResult) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  countryBias?: string[]; // ISO-2 codes (lowercase)
}

const componentValue = (
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
  short = false,
): string | null => {
  if (!components) return null;
  const c = components.find((x) => x.types.includes(type));
  if (!c) return null;
  return short ? c.short_name : c.long_name;
};

export function PlacesAutocomplete({
  id,
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  invalid,
  disabled,
  countryBias = ["ae"],
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const { ready, error } = useGoogleMaps();

  useEffect(() => {
    if (!ready || !inputRef.current || acRef.current) return;
    const g = (window as any).google;
    const ac = new g.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "place_id", "address_components", "name"],
      componentRestrictions: countryBias?.length ? { country: countryBias } : undefined,
    });
    acRef.current = ac;
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const comps = place.address_components;
      const formatted =
        place.formatted_address ??
        (place.name ? String(place.name) : inputRef.current?.value ?? "");
      const result: PlaceResult = {
        address_formatted: formatted,
        latitude: place.geometry?.location?.lat() ?? null,
        longitude: place.geometry?.location?.lng() ?? null,
        place_id: place.place_id ?? null,
        city:
          componentValue(comps, "locality") ??
          componentValue(comps, "postal_town") ??
          componentValue(comps, "administrative_area_level_2") ??
          componentValue(comps, "administrative_area_level_1"),
        country: componentValue(comps, "country", true)?.toUpperCase() ?? null,
        community:
          componentValue(comps, "sublocality_level_1") ??
          componentValue(comps, "sublocality") ??
          componentValue(comps, "neighborhood") ??
          null,
      };
      onChange(formatted);
      onPlaceSelected(result);
    });
    return () => {
      listener.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="space-y-1">
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ready ? placeholder : "Loading map search…"}
        disabled={disabled || !ready}
        className={cn(invalid && "border-destructive")}
        autoComplete="off"
        aria-invalid={!!invalid}
      />
      {error && <p className="text-xs text-destructive">Map search unavailable: {error}</p>}
    </div>
  );
}
