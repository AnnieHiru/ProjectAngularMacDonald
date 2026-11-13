import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LeafletDirective, LeafletLayersDirective } from '@bluehalo/ngx-leaflet';
import {
  icon,
  latLng,
  latLngBounds,
  marker,
  tileLayer,
  type Layer,
  type Map as LeafletMap,
  type MapOptions,
} from 'leaflet';
import { distinctUntilChanged, map, Subject, tap } from 'rxjs';
import { type City, NominatimService } from '../../services/nominatim-service';
import { type Restaurant } from '../../services/restaurant-service';
import { Store } from '@ngrx/store';
import { clearRestaurants, loadRestaurants } from '../../store/restaurants.actions';
import { selectRestaurants, selectRestaurantsLoading } from '../../store/restaurants.selectors';
import { PopupComponent } from '../popup-component/popup-component';

// Icône McDonald's (« M » jaune sur fond rouge), servie depuis public/.
const mcdoIcon = icon({
  iconUrl: 'mcdonalds-marker.svg',
  iconSize: [36, 46],
  iconAnchor: [18, 45], // pointe du marqueur
  popupAnchor: [0, -40],
});

/** Rayon de recherche des restaurants autour de la ville, en mètres. */
const SEARCH_RADIUS = 10000;

@Component({
  selector: 'app-mapcomponent',
  imports: [LeafletDirective, LeafletLayersDirective, ReactiveFormsModule, PopupComponent],
  templateUrl: './mapcomponent.html',
  styleUrl: './mapcomponent.css',
})
export class MapComponent {
  private readonly nominatim = inject(NominatimService);
  private readonly store = inject(Store);
  private map?: LeafletMap;

  protected readonly options: MapOptions = {
    layers: [
      tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }),
    ],
    zoom: 12,
    center: latLng(48.8566, 2.3522),
  };

  /**
   * Formulaire typé :
   * - `search` : texte saisi, validé (requis + longueur minimale) ;
   * - `city`   : ville choisie dans les suggestions, source unique de vérité pour la recherche de restaurants.
   */
  protected readonly form = new FormGroup({
    search: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(NominatimService.MIN_QUERY_LENGTH)],
    }),
    city: new FormControl<City | null>(null),
  });
  protected readonly minQueryLength = NominatimService.MIN_QUERY_LENGTH;

  /** Recherche immédiate demandée par le bouton loupe / la touche Entrée. */
  private readonly submit$ = new Subject<string>();

  /** Dernier résultat de recherche de villes (saisie debouncée ou loupe). */
  private readonly citySearch = toSignal(
    this.nominatim.searchCitiesFromInput(
      // On n'interroge l'API que si le champ est valide (inutile d'envoyer « Pa »).
      this.form.controls.search.valueChanges.pipe(map((q) => (this.form.controls.search.valid ? q : ''))),
      this.submit$,
    ),
  );
  protected readonly cities = computed(() => this.citySearch()?.cities ?? []);
  protected readonly showSuggestions = signal(false);
  /** Recherche lancée par le bouton loupe en cours. */
  protected readonly searching = signal(false);
  protected readonly notFound = signal(false);
  protected readonly radiusKm = SEARCH_RADIUS / 1000;

  protected readonly selectedCity = toSignal(this.form.controls.city.valueChanges, { initialValue: null });
  protected readonly restaurants = this.store.selectSignal(selectRestaurants);
  protected readonly loading = this.store.selectSignal(selectRestaurantsLoading);
  protected readonly markers = signal<Layer[]>([]);
  /** Restaurant dont la fiche est affichée dans la popup (null = popup fermée). */
  protected readonly selectedRestaurant = signal<Restaurant | null>(null);
  /** Restaurant retenu par l'utilisateur via le bouton « Choisir » de la popup. */
  protected readonly chosenRestaurant = signal<Restaurant | null>(null);

  constructor() {
    effect(() => {
      const restaurants = this.restaurants();
      const city = this.selectedCity();
      this.markers.set(restaurants.map((restaurant) => this.toMarker(restaurant)));

      if (city && restaurants.length > 0) {
        const bounds = latLngBounds(restaurants.map((restaurant) => [restaurant.lat, restaurant.lng]));
        this.map?.fitBounds(bounds.extend([city.lat, city.lng]), { padding: [30, 30], maxZoom: 15 });
      }
    });

    // Résultat d'une recherche par la loupe : on sélectionne directement la première ville.
    effect(() => {
      const result = this.citySearch();
      if (!result?.submitted) return;
      untracked(() => {
        this.searching.set(false);
        const [first] = result.cities;
        this.notFound.set(!first);
        if (first) this.selectCity(first);
      });
    });

    this.form.controls.search.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.showSuggestions.set(true);
      this.notFound.set(false);
      // Modifier le texte invalide la ville précédemment choisie.
      if (this.form.controls.city.value) this.form.controls.city.setValue(null);
    });

    // switchMap : si l'utilisateur choisit une autre ville avant la fin de la requête,
    // la précédente est annulée et ses résultats ne viennent pas écraser les nouveaux.
    this.form.controls.city.valueChanges
      .pipe(
        distinctUntilChanged((previous, current) => previous?.id === current?.id),
        tap((city) => {
          this.markers.set([]);
          if (city) {
            this.map?.setView([city.lat, city.lng], 13);
            this.store.dispatch(loadRestaurants({ city, radius: SEARCH_RADIUS }));
          } else {
            this.store.dispatch(clearRestaurants());
          }
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected onMapReady(map: LeafletMap): void {
    this.map = map;
  }

  /**
   * Bouton loupe ou touche Entrée : sélectionne la première ville trouvée.
   * Si les suggestions pour ce texte sont déjà chargées, aucune requête n'est envoyée ;
   * sinon la recherche part tout de suite, sans attendre le debounce.
   */
  protected onSubmit(): void {
    const search = this.form.controls.search;
    if (search.invalid) {
      search.markAsDirty(); // affiche le message de validation
      return;
    }

    const query = search.value.trim();
    const last = this.citySearch();
    if (last?.query === query && last.cities.length > 0) {
      this.selectCity(last.cities[0]);
      return;
    }

    this.searching.set(true);
    this.submit$.next(query);
  }

  protected selectCity(city: City): void {
    this.showSuggestions.set(false);
    this.form.controls.search.setValue(city.name, { emitEvent: false });
    this.form.controls.city.setValue(city);
  }

  /** Clic sur un restaurant (liste ou marqueur) : centre la carte et ouvre sa fiche. */
  protected openRestaurant(r: Restaurant): void {
    this.map?.setView([r.lat, r.lng], 17);
    this.selectedRestaurant.set(r);
  }

  private toMarker(r: Restaurant): Layer {
    return marker([r.lat, r.lng], { icon: mcdoIcon, title: r.name }).on('click', () => this.openRestaurant(r));
  }
}
