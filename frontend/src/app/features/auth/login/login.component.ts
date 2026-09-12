import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AppFooterComponent } from '../../../shared/components/app-footer/app-footer.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppFooterComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  // inject() en vez de parámetro de constructor: así "fb" ya está
  // disponible al momento de inicializar el campo "form" (con inyección
  // por constructor, el campo se evalúa antes de que el parámetro exista).
  private fb = inject(FormBuilder);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  // Fotos reales del hotel + su frase asociada, en pares sincronizados
  // (antes rotaban con índices independientes; con longitudes distintas de
  // fondos/frases se podían desincronizar y mostrar una frase que no
  // correspondía a la foto visible).
  slides = [
    {
      bg: 'assets/login/room1.jpg',
      phrase: 'Cada detalle cuenta. Ayúdanos a que cada estadía sea perfecta.',
    },
    {
      bg: 'assets/login/room2.jpg',
      phrase: 'Una queja atendida a tiempo es una experiencia recuperada.',
    },
    {
      bg: 'assets/login/room3.jpg',
      phrase: 'Del registro a la solución: todo en un mismo lugar.',
    },
    {
      bg: 'assets/login/room4.jpg',
      phrase: 'La hospitalidad también se gestiona con datos.',
    },
    {
      bg: 'assets/login/room5.jpg',
      phrase: 'Piso 26: la mejor vista de Barranquilla también merece el mejor servicio.',
    },
    {
      bg: 'assets/login/room6.jpg',
      phrase: 'Habitaciones impecables, gestionadas con la misma atención al detalle.',
    },
    {
      bg: 'assets/login/room7.jpg',
      phrase: 'Un buen descanso junto a la piscina también merece un buen seguimiento.',
    },
    {
      bg: 'assets/login/room8.jpg',
      phrase: 'Cada rincón del hotel cuenta una historia de servicio.',
    },
    {
      bg: 'assets/login/room9.jpg',
      phrase: 'En Pulpo Paul, cada experiencia gastronómica también merece seguimiento.',
    },
  ];
  activeSlideIndex = signal(Math.floor(Math.random() * this.slides.length));

  private rotationTimer?: ReturnType<typeof setInterval>;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Cada 7s se avanza a la siguiente pareja foto+frase, en bucle. Un
    // único intervalo evita timers duplicados y facilita limpiarlo al salir.
    this.rotationTimer = setInterval(() => {
      this.activeSlideIndex.update((i) => (i + 1) % this.slides.length);
    }, 7000);
  }

  ngOnDestroy(): void {
    if (this.rotationTimer) clearInterval(this.rotationTimer);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email!, password!).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Credenciales inválidas');
      },
    });
  }
}
