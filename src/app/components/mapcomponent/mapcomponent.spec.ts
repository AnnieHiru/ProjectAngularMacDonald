import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { RestaurantsEffects } from '../../store/restaurants.effects';
import { restaurantsReducer } from '../../store/restaurants.reducer';
import { MapComponent } from './mapcomponent';

describe('MapComponent', () => {
  let component: MapComponent;
  let fixture: ComponentFixture<MapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore({ restaurants: restaurantsReducer }),
        provideEffects([RestaurantsEffects]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
