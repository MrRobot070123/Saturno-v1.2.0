import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';

export interface ClassifiedFinding {
  excerpt: string;
  areaId?: string;
  subtypeId?: string;
  suggestedName?: string;
  suggestedArea?: string;
  confidence: number;
}

// Clasificación automática de reseñas con IA (Fase B). Usa Claude Haiku (el
// modelo más económico) + prompt caching sobre el catálogo de tipos de queja
// del hotel, que es el mismo para todas las reseñas y cambia poco: así
// Anthropic solo cobra el precio completo de ese bloque la primera vez
// dentro de la ventana de caché, y las siguientes llamadas salen ~90% más
// baratas. Costo estimado total: <US$1/mes con el volumen de este hotel.
@Injectable()
export class ReviewClassifierService {
  private readonly logger = new Logger(ReviewClassifierService.name);
  private readonly client: Anthropic | null;

  constructor(private config: ConfigService, private prisma: PrismaService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async classify(hotelId: string, rawText: string): Promise<ClassifiedFinding[]> {
    if (!this.client) {
      throw new Error(
        'ANTHROPIC_API_KEY no está configurada: no se puede clasificar la reseña con IA.',
      );
    }

    const subtypes = await this.prisma.caseSubtype.findMany({
      where: { area: { hotelId }, type: 'QUEJA', isActive: true },
      include: { area: { select: { id: true, name: true } } },
      orderBy: [{ area: { name: 'asc' } }, { name: 'asc' }],
    });

    const areas = await this.prisma.area.findMany({
      where: { hotelId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const catalogText = subtypes.length
      ? subtypes
          .map((s) => `- Área: "${s.area.name}" | Tipo de queja: "${s.name}" (subtypeId=${s.id})`)
          .join('\n')
      : '(El hotel aún no tiene tipos de queja registrados en el catálogo)';

    const areaNames = areas.map((a) => a.name).join(', ') || '(sin áreas registradas)';

    const systemPrompt = `Eres un clasificador de reseñas de huéspedes de un hotel. Tu única tarea es identificar, dentro del texto de una reseña, cada queja o problema distinto que mencione el huésped, y asociarlo con el catálogo de tipos de queja del hotel.

Catálogo de tipos de queja existentes (área | tipo | subtypeId):
${catalogText}

Áreas activas del hotel (usa EXACTAMENTE uno de estos nombres cuando sugieras un área nueva para un tipo de queja; nunca inventes una que no esté en esta lista): ${areaNames}

Reglas:
- Una reseña puede contener cero, uno o varios problemas distintos, de la misma o de distintas áreas.
- Si el problema encaja claramente en un tipo existente del catálogo, usa su subtypeId exacto en "matchedSubtypeId".
- Si el problema es real pero NO hay un tipo existente que lo describa bien, deja "matchedSubtypeId" en null y en su lugar llena "suggestedName" (un nombre breve de 2 a 6 palabras, en español, tal como se vería en un catálogo de tipos de queja) y "suggestedArea" (tomado EXACTAMENTE de la lista de áreas activas de arriba).
- Si el texto no describe ningún problema (reseña neutra o solo positiva), devuelve una lista vacía.
- "confidence" es un número entre 0 y 1 que refleja qué tan seguro estás de la clasificación.
- "excerpt" debe ser el fragmento literal del texto original que sustenta ese hallazgo (cópialo tal cual, no lo resumas ni lo traduzcas).`;

    let message;
    try {
      message = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } } as any],
        messages: [
          { role: 'user', content: `Texto de la reseña del huésped:\n"""\n${rawText}\n"""` },
        ],
        tools: [
          {
            name: 'report_findings',
            description: 'Reporta los hallazgos (quejas) detectados en el texto de la reseña.',
            input_schema: {
              type: 'object',
              properties: {
                findings: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      excerpt: { type: 'string' },
                      matchedSubtypeId: { type: ['string', 'null'] },
                      suggestedName: { type: ['string', 'null'] },
                      suggestedArea: { type: ['string', 'null'] },
                      confidence: { type: 'number' },
                    },
                    required: ['excerpt', 'confidence'],
                  },
                },
              },
              required: ['findings'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'report_findings' },
      });
    } catch (err: any) {
      this.logger.error(`Error llamando a Claude: ${err?.message ?? err}`);
      throw new Error(`Error llamando a Claude: ${err?.message ?? 'desconocido'}`);
    }

    const toolUse = message.content.find((b: any) => b.type === 'tool_use') as any;
    const rawFindings: any[] = toolUse?.input?.findings ?? [];

    const subtypeById = new Map(subtypes.map((s) => [s.id, s]));
    const areaByName = new Map(areas.map((a) => [a.name, a.id]));

    const results: ClassifiedFinding[] = [];
    for (const f of rawFindings) {
      if (!f?.excerpt) continue;
      const confidence = typeof f.confidence === 'number' ? f.confidence : 0.5;
      const matched = f.matchedSubtypeId ? subtypeById.get(f.matchedSubtypeId) : undefined;

      if (matched) {
        results.push({ excerpt: f.excerpt, areaId: matched.areaId, subtypeId: matched.id, confidence });
      } else {
        results.push({
          excerpt: f.excerpt,
          areaId: f.suggestedArea ? areaByName.get(f.suggestedArea) : undefined,
          suggestedName: f.suggestedName ?? undefined,
          suggestedArea: f.suggestedArea ?? undefined,
          confidence,
        });
      }
    }
    return results;
  }
}