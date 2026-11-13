import { afterNextRender, Component, signal, type Type } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, NgComponentOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('mac_donald');
  protected readonly mapComponent = signal<Type<unknown> | null>(null);

  constructor() {
    // Leaflet a besoin de window/document : on ne charge la carte que dans le navigateur.
    // afterNextRender n'est jamais exécuté côté serveur (SSR / prerender).
    afterNextRender(async () => {
      const { MapComponent } = await import('./components/mapcomponent/mapcomponent');
      this.mapComponent.set(MapComponent);
    });
  }
}
