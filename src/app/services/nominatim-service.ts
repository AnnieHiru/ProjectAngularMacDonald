import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  map,
  merge,
  type Observable,
  of,
  switchMap,
} from 'rxjs';

/** Réponse brute de l'API Nominatim (format jsonv2 + addressdetails). */
interface NominatimPlace {
  place_id: number;
  lat: string;
  lon: string;
  name: string;
  display_name: string;
  addresstype: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

/** Ville simplifiée, exploitable directement par les composants (carte, liste…). */
export interface City {
  id: number;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  postcode?: string;
  country?: string;
}

/** Résultat d'une recherche de villes, avec le texte recherché et son origine. */
export interface CitySearchResult {
  query: string;
  cities: City[];
  /** true si la recherche vient du bouton loupe / de la touche Entrée. */
  submitted: boolean;
}

@Injectable({ providedIn: 'root' })
export class NominatimService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://nominatim.openstreetmap.org/search';

  /** Nombre minimum de caractères avant de lancer une recherche. */
  static readonly MIN_QUERY_LENGTH = 3;

  /**
   * Recherche des villes correspondant au texte saisi.
   * En cas d'erreur réseau, renvoie une liste vide plutôt que de casser le flux.
   */
  searchCities(query: string, limit = 3): Observable<City[]> {
    const q = query.trim();
    if (q.length < NominatimService.MIN_QUERY_LENGTH) {
      return of([]);
    }

    const params = new HttpParams()
      .set('q', q)
      .set('format', 'jsonv2')
      .set('addressdetails', '1')
      .set('featureType', 'city') // limite aux lieux habités (city, town, village…)
      .set('accept-language', 'fr')
      .set('limit', limit);

    return this.http.get<NominatimPlace[]>(this.baseUrl, { params }).pipe(
      map((places) => places.map(toCity)),
      catchError((err) => {
        console.error('Erreur Nominatim', err);
        return of([]);
      }),
    );
  }

  /**
   * Branche la saisie utilisateur (ex. `control.valueChanges`) et, optionnellement,
   * un déclencheur de recherche immédiate (bouton loupe / touche Entrée) sur l'API.
   *
   * - debounceTime(1 s) sur la saisie : une seule requête quand l'utilisateur arrête de taper
   *   (la politique d'usage Nominatim impose max. 1 requête/seconde) ;
   * - la recherche immédiate court-circuite ce délai ;
   * - distinctUntilChanged : pas de nouvelle requête pour un texte déjà recherché
   *   (ex. la saisie « Paris » qui arrive après un clic sur la loupe pour « Paris ») ;
   * - switchMap : annule la requête en cours dès qu'une nouvelle recherche démarre,
   *   pour ne jamais afficher les résultats d'un texte obsolète.
   */
  searchCitiesFromInput(
    input$: Observable<string | null>,
    submit$: Observable<string> = EMPTY,
  ): Observable<CitySearchResult> {
    const typed$ = input$.pipe(
      map((value) => ({ query: (value ?? '').trim(), submitted: false })),
      debounceTime(1000),
    );
    const submitted$ = submit$.pipe(map((value) => ({ query: value.trim(), submitted: true })));

    return merge(typed$, submitted$).pipe(
      // Une recherche immédiate passe toujours ; une saisie identique à la précédente est ignorée.
      distinctUntilChanged((prev, curr) => !curr.submitted && prev.query === curr.query),
      switchMap(({ query, submitted }) =>
        this.searchCities(query).pipe(map((cities) => ({ query, cities, submitted }))),
      ),
    );
  }
}

function toCity(place: NominatimPlace): City {
  const a = place.address;
  return {
    id: place.place_id,
    name: a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? place.name,
    displayName: place.display_name,
    lat: Number(place.lat),
    lng: Number(place.lon),
    postcode: a?.postcode,
    country: a?.country,
  };
}
