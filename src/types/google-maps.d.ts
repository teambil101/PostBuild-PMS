// Minimal ambient types for Google Maps Places Autocomplete
declare namespace google {
  namespace maps {
    interface LatLng {
      lat(): number;
      lng(): number;
    }
    interface MapsEventListener {
      remove(): void;
    }
    interface GeocoderAddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }
    namespace places {
      interface PlaceResult {
        address_components?: GeocoderAddressComponent[];
        formatted_address?: string;
        geometry?: { location?: LatLng };
        place_id?: string;
        name?: string;
      }
      interface AutocompleteOptions {
        fields?: string[];
        componentRestrictions?: { country: string | string[] };
        types?: string[];
      }
      class Autocomplete {
        constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
        addListener(event: string, handler: () => void): MapsEventListener;
        getPlace(): PlaceResult;
      }
    }
  }
}
