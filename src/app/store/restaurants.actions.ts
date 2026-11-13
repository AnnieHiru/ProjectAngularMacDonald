import { createAction, props } from '@ngrx/store';
import { type City } from '../services/nominatim-service';
import { type Restaurant } from '../services/restaurant-service';

export const loadRestaurants = createAction(
  '[Map] Load Restaurants',
  props<{ city: City; radius: number }>(),
);

export const loadRestaurantsSuccess = createAction(
  '[Restaurants API] Load Restaurants Success',
  props<{ restaurants: Restaurant[] }>(),
);

export const loadRestaurantsFailure = createAction(
  '[Restaurants API] Load Restaurants Failure',
  props<{ error: string }>(),
);

export const clearRestaurants = createAction('[Map] Clear Restaurants');