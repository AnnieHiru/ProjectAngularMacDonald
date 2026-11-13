import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { type City, type CitySearchResult, NominatimService } from './nominatim-service';

describe('NominatimService', () => {
  let service: NominatimService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NominatimService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('ne fait pas de requête pour une saisie trop courte', () => {
    let result: City[] | undefined;
    service.searchCities('Pa').subscribe((r) => (result = r));
    expect(result).toEqual([]);
  });

  it('interroge Nominatim et mappe la réponse', () => {
    let result: City[] | undefined;
    service.searchCities('Paris').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url === 'https://nominatim.openstreetmap.org/search');
    expect(req.request.params.get('q')).toBe('Paris');
    expect(req.request.params.get('format')).toBe('jsonv2');
    req.flush([
      {
        place_id: 1,
        lat: '48.8566',
        lon: '2.3522',
        name: 'Paris',
        display_name: 'Paris, Île-de-France, France',
        addresstype: 'city',
        address: { city: 'Paris', postcode: '75000', country: 'France' },
      },
    ]);

    expect(result).toEqual([
      {
        id: 1,
        name: 'Paris',
        displayName: 'Paris, Île-de-France, France',
        lat: 48.8566,
        lng: 2.3522,
        postcode: '75000',
        country: 'France',
      },
    ]);
  });

  describe('searchCitiesFromInput', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const isSearch = (r: { url: string }) => r.url === 'https://nominatim.openstreetmap.org/search';

    it('debounce : une seule requête pour la dernière saisie', () => {
      const input$ = new Subject<string>();
      const results: CitySearchResult[] = [];
      service.searchCitiesFromInput(input$).subscribe((r) => results.push(r));

      input$.next('Par');
      vi.advanceTimersByTime(500);
      input$.next('Paris');
      httpMock.expectNone(isSearch); // rien avant la fin du délai

      vi.advanceTimersByTime(1000);
      const req = httpMock.expectOne(isSearch);
      expect(req.request.params.get('q')).toBe('Paris');
      req.flush([]);
      expect(results).toEqual([{ query: 'Paris', cities: [], submitted: false }]);
    });

    it('loupe : recherche immédiate, la saisie identique qui suit est ignorée', () => {
      const input$ = new Subject<string>();
      const submit$ = new Subject<string>();
      service.searchCitiesFromInput(input$, submit$).subscribe();

      input$.next('Rennes');
      submit$.next('Rennes');
      httpMock.expectOne(isSearch).flush([]); // sans attendre le debounce

      vi.advanceTimersByTime(1000);
      httpMock.expectNone(isSearch); // « Rennes » déjà recherché
    });

    it('switchMap : annule la requête précédente', () => {
      const input$ = new Subject<string>();
      const submit$ = new Subject<string>();
      service.searchCitiesFromInput(input$, submit$).subscribe();

      submit$.next('Lille');
      const first = httpMock.expectOne(isSearch);
      submit$.next('Rennes');
      httpMock.expectOne(isSearch);

      expect(first.cancelled).toBe(true);
    });
  });
});
