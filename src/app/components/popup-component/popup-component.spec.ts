import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PopupComponent } from './popup-component';

describe('PopupComponent', () => {
  let component: PopupComponent;
  let fixture: ComponentFixture<PopupComponent>;

  beforeEach(async () => {
    // jsdom n'implémente pas showModal() / close() de <dialog> : on les simule.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };

    await TestBed.configureTestingModule({
      imports: [PopupComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PopupComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('restaurant', {
      id: '1',
      name: "McDonald's Opéra",
      lat: 48.87,
      lng: 2.33,
      address: '1 rue de la Paix, 75002 Paris',
    });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('affiche les informations du restaurant', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h2')?.textContent).toContain("McDonald's Opéra");
    expect(el.textContent).toContain('1 rue de la Paix, 75002 Paris');
    expect(el.textContent).toContain('Non renseignés'); // pas d'horaires
  });

  it('émet le restaurant au clic sur « Choisir »', () => {
    let chosen: unknown;
    component.chosen.subscribe((r) => (chosen = r));

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.choose');
    button?.click();

    expect(chosen).toEqual(expect.objectContaining({ id: '1', name: "McDonald's Opéra" }));
  });
});
