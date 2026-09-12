import { Directive, ElementRef, HostListener } from '@angular/core';

// Fuerza el formato "tipo oración" mientras el usuario escribe, sin
// importar la configuración de su teclado/autocorrección: minúscula por
// defecto, mayúscula al inicio del texto y después de cada punto o salto
// de línea. Se usa en campos de descripción (regla de captura pedida para
// mantener consistencia en los reportes, sin importar quién digite).
//
// Ej.: "esto ES un ejemplo. otra frase" -> "Esto es un ejemplo. Otra frase"
@Directive({
  selector: '[appSentenceCase]',
  standalone: true,
})
export class SentenceCaseDirective {
  constructor(private el: ElementRef<HTMLInputElement | HTMLTextAreaElement>) {}

  @HostListener('input')
  onInput(): void {
    const input = this.el.nativeElement;
    const cursor = input.selectionStart ?? input.value.length;

    const transformed = this.toSentenceCase(input.value);
    if (transformed === input.value) return;

    input.value = transformed;
    // La transformación solo cambia mayúsculas/minúsculas, nunca agrega ni
    // quita caracteres, así que la posición del cursor no se desplaza.
    input.setSelectionRange(cursor, cursor);

    // Angular no detecta el cambio de "value" hecho manualmente sobre el
    // elemento nativo: se dispara un evento para que [(ngModel)]/formControl
    // tomen el valor ya transformado.
    input.dispatchEvent(new Event('input', { bubbles: false }));
  }

  private toSentenceCase(text: string): string {
    let result = text.toLowerCase();
    // Mayúscula al inicio del texto, y después de '.', '?', '!' o salto de
    // línea (seguidos de los espacios que haya, incluyendo ninguno).
    result = result.replace(/(^\s*\p{L})|([.?!\n]\s*\p{L})/gu, (match) => match.toUpperCase());
    return result;
  }
}
