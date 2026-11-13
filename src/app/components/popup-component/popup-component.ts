import { afterNextRender, Component, type ElementRef, input, output, viewChild } from '@angular/core';
import { type Restaurant } from '../../services/restaurant-service';

/**
 * Fiche d'un restaurant affichée en fenêtre modale.
 * Utilise l'élément natif <dialog> : fermeture avec Échap, focus piégé et fond grisé inclus.
 */
@Component({
  imports: [],
  selector: 'app-popup-component',
  styleUrl: './popup-component.css',
  templateUrl: './popup-component.html',
})
export class PopupComponent {
  readonly restaurant = input.required<Restaurant>();
  readonly closed = output<void>();
  /** Émis quand l'utilisateur clique sur « Choisir ». */
  readonly chosen = output<Restaurant>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected close(): void {
    this.dialog().nativeElement.close(); // déclenche l'événement (close) → closed.emit()
  }

  protected choose(): void {
    this.chosen.emit(this.restaurant());
    this.close();
  }

  /** Un clic sur le fond (hors de la fiche) ferme la fenêtre. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.close();
    }
  }
}
