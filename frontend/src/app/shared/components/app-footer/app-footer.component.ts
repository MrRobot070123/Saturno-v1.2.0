import { Component } from '@angular/core';
import { APP_VERSION } from '../../../core/version';

// Pie de página con el aviso de propiedad intelectual, reutilizado tanto en
// el layout autenticado como en la pantalla de login. El año se calcula en
// tiempo de ejecución (no queda hardcodeado), así que nunca queda desfasado.
@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="app-footer">
      © {{ currentYear }} Daniel Andrés Pacheco Mejía. Todos los derechos reservados.
      <span class="app-footer-brand">SATURNO · Quejas y Solicitudes <span class="app-footer-version">v{{ version }}</span></span>
    </footer>
  `,
  styles: [
    `
      .app-footer {
        text-align: center;
        font-size: 12px;
        color: var(--color-text-muted);
        padding: 16px 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .app-footer-brand {
        font-weight: 600;
        color: var(--color-primary);
      }
      .app-footer-version {
        font-weight: 500;
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class AppFooterComponent {
  currentYear = new Date().getFullYear();
  version = APP_VERSION;
}
