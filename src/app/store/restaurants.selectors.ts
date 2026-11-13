import { createFeatureSelector, createSelector } from '@ngrx/store';
import { type RestaurantsState } from './restaurants.reducer';

export const selectRestaurantsState = createFeatureSelector<RestaurantsState>('restaurants');
export const selectRestaurants = createSelector(selectRestaurantsState, (state) => state.items);
export const selectRestaurantsLoading = createSelector(selectRestaurantsState, (state) => state.loading);
export const selectRestaurantsError = createSelector(selectRestaurantsState, (state) => state.error);