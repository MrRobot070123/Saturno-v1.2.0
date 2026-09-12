import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent {
  // Solo con inyectarlo aquí ya se aplica el tema guardado (o el del
  // sistema operativo) desde el primer render, antes incluso del login.
  private theme = inject(ThemeService);
}
