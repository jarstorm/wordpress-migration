# Auditoría web — {dominio}

**Español** · [English](en/REPORT-TEMPLATE.md) _(quita esta línea en el informe)_

{fecha} · {autor}

## Resumen

{Una frase con la conclusión principal y su número. Ej.: "La web suspende en móvil: los usuarios reales tardan 3,1 s en ver el contenido principal y la ficha de producto se bloquea 11 s."}

- **{Hallazgo 1 con número}.**
- **{Hallazgo 2 con número}.**
- **{Hallazgo 3 con número}.**
- **{Seguridad en una línea}.**

{Lo positivo en una frase (accesibilidad, SEO técnico…). Qué es el problema y qué no.}

## Rendimiento (PageSpeed Insights)

{Conclusión: aprueba o no las Core Web Vitals en móvil y escritorio.}

| Categoría | Móvil | Escritorio |
| --- | --- | --- |
| Rendimiento | | |
| Accesibilidad | | |
| Buenas prácticas | | |
| SEO | | |

**Usuarios reales** (Chrome UX Report, últimos 28 días):

| Métrica | Móvil | Escritorio | Objetivo de Google |
| --- | --- | --- | --- |
| Core Web Vitals | | | — |
| LCP: carga del contenido principal | | | < 2,5 s |
| FCP: primer contenido visible | | | < 1,8 s |
| TTFB: respuesta del servidor | | | < 0,8 s |
| CLS: estabilidad visual | | | < 0,1 |

**Mejoras que estima Google en móvil:**

| Problema | Ahorro estimado |
| --- | --- |

[Informe de PageSpeed Insights]({enlace})

## Análisis técnico

{Conclusión: peso y número de peticiones frente a lo que muestra la página.}

**Tecnología detectada:** {WordPress x.y, tema, maquetador, tienda, servidor}.

| Plugin | Función |
| --- | --- |

| Tipo de recurso | Peticiones | Peso |
| --- | --- | --- |

**Problemas principales:**

1. …

## Diseño y conversión

{Conclusión: ¿la web vende? ¿Se entiende qué ofrece?}

**Portada.** …
**Navegación.** …
**Listado / catálogo.** …
**Página de detalle.** …
**¿Está anticuado?** …

**Mejoras con más impacto en ventas**, por orden:

1. …

{Si no hay analítica: "No tenemos datos de ventas ni de analítica, así que no podemos cuantificar cuánto subirían las ventas."}

## Enlaces y páginas

{Conclusión: X de N páginas con error, desde dónde.}

**Alcance:** {qué se rastreó, cuántas páginas quedaron sin revisar}.

| Hallazgo | Detalle | Impacto |
| --- | --- | --- |

## Rendimiento de las páginas clave

| Página | Rendimiento | LCP | Bloqueo total | Speed Index |
| --- | --- | --- | --- | --- |

{Explicación del culpable principal, si lo hay.}

## Seguridad

{Conclusión: "No hay ninguna vulnerabilidad confirmada, pero…". Solo comprobaciones pasivas.}

| Hallazgo | Por qué importa | Gravedad |
| --- | --- | --- |

{Una auditoría completa de seguridad necesita permiso del titular del sitio.}

## Propuesta

{Recomendación en una o dos frases.}

| | Opción A: optimizar | Opción B: Astro + WordPress headless |
| --- | --- | --- |
| Qué se hace | | |
| Resultado esperado | | |
| Qué cambia para quien edita | Nada | |
| Esfuerzo | | |
| Precio orientativo | | |
| Riesgo | Bajo | |

{Precios estimados sin IVA, antes de ver el panel.}

### Qué cambia con la Opción B

**Lo que se queda igual en WordPress:**

| Plugin o función | Qué pasa |
| --- | --- |

**Lo que cambia:**

| Plugin o función | Hoy | Con Astro |
| --- | --- | --- |

**Por confirmar con acceso al panel:** …

**Siguiente paso:** {acceso de solo lectura al panel para cerrar presupuesto}.

## Metodología y limitaciones

- **Rendimiento:** …
- **Análisis técnico:** …
- **Diseño y enlaces:** …
- **Seguridad:** solo comprobaciones pasivas.
- **Pendiente:** …

## Fuentes

- …
