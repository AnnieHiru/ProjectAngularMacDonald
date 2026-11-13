import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, EMPTY, map, of, switchMap, takeUntil } from 'rxjs';
import { RestaurantService } from '../services/restaurant-service';
import { clearRestaurants, loadRestaurants, loadRestaurantsFailure, loadRestaurantsSuccess } from './restaurants.actions';

@Injectable()
export class RestaurantsEffects {
  private readonly actions$ = inject(Actions);
  private readonly restaurantService = inject(RestaurantService);

  readonly loadRestaurants$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadRestaurants),
      switchMap(({ city, radius }) =>
        this.restaurantService.findMcDonalds(city.lat, city.lng, radius).pipe(
          map((restaurants) => loadRestaurantsSuccess({ restaurants })),
          catchError((error: unknown) =>
            of(loadRestaurantsFailure({ error: error instanceof Error ? error.message : 'Restaurant search failed' })),
          ),
          takeUntil(this.actions$.pipe(ofType(loadRestaurants, clearRestaurants))),
        ),
      ),
    ),
  );
}