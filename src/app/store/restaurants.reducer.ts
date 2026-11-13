import { createReducer, on } from '@ngrx/store';
import { type Restaurant } from '../services/restaurant-service';
import {
  clearRestaurants,
  loadRestaurants,
  loadRestaurantsFailure,
  loadRestaurantsSuccess,
} from './restaurants.actions';

export interface RestaurantsState {
  items: Restaurant[];
  loading: boolean;
  error: string | null;
}

const initialState: RestaurantsState = {
  items: [],
  loading: false,
  error: null,
};

export const restaurantsReducer = createReducer(
  initialState,
  on(loadRestaurants, (state) => ({ ...state, items: [], loading: true, error: null })),
  on(loadRestaurantsSuccess, (state, { restaurants }) => ({ ...state, items: restaurants, loading: false })),
  on(loadRestaurantsFailure, (state, { error }) => ({ ...state, loading: false, error })),
  on(clearRestaurants, () => initialState),
);