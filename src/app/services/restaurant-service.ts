import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, type Observable, of } from 'rxjs';

/** Réponse brute de Nominatim (format jsonv2 + addressdetails + extratags). */
interface NominatimPoi {
  place_id: number;
  lat: string;
  lon: string;
  name: string;
  category: string;
  type: string;
  address?: {
    house_number?: string;
    road?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
  };
  extratags?: Record<string, string> | null;
}

export interface Restaurant {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
}

@Injectable({ providedIn: 'root' })
export class RestaurantService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://nominatim.openstreetmap.org/search';

  /**
   * Recherche les McDonald's dans un rayon (en mètres) autour d'un point.
   * Nominatim ne cherche que dans un rectangle (viewbox) : on le construit autour
   * du point, puis on ne garde que les restaurants réellement dans le rayon.
   */
  findMcDonalds(lat: number, lng: number, radius = 5000): Observable<Restaurant[]> {
    const dLat = radius / 111_320;
    const dLng = radius / (111_320 * Math.cos((lat * Math.PI) / 180));

    const params = new HttpParams()
      .set('q', "McDonald's")
      .set('format', 'jsonv2')
      .set('addressdetails', '1')
      .set('extratags', '1')
      .set('viewbox', [lng - dLng, lat + dLat, lng + dLng, lat - dLat].join(','))
      .set('bounded', '1')
      .set('limit', 40); // maximum autorisé par Nominatim

    return this.http.get<NominatimPoi[]>(this.baseUrl, { params }).pipe(
      map((pois) =>
        pois
          .filter((p) => p.category === 'amenity' && p.type === 'fast_food')
          .map(toRestaurant)
          .filter((r) => distance(lat, lng, r.lat, r.lng) <= radius),
      ),
      catchError((err) => {
        console.error('Erreur Nominatim (restaurants)', err);
        return of([]);
      }),
    );
  }
}

function toRestaurant(p: NominatimPoi): Restaurant {
  const a = p.address;
  const street = [a?.house_number, a?.road].filter(Boolean).join(' ');
  const city = [a?.postcode, a?.city ?? a?.town ?? a?.village].filter(Boolean).join(' ');
  const address = [street, city].filter(Boolean).join(', ');

  return {
    id: String(p.place_id),
    name: p.name || "McDonald's",
    lat: Number(p.lat),
    lng: Number(p.lon),
    address: address || undefined,
    openingHours: p.extratags?.['opening_hours'],
    phone: p.extratags?.['phone'] ?? p.extratags?.['contact:phone'],
    website: p.extratags?.['website'] ?? p.extratags?.['contact:website'],
  };
}

/** Distance en mètres entre deux points (formule de haversine). */
function distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
