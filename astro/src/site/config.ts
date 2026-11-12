/**
 * Datos del cliente que no están en WordPress (o que se quieren fijar en el diseño).
 * Lo usan la cabecera y el pie.
 */
export const siteConfig = {
  /** Botón destacado de la cabecera. */
  cta: { label: 'Pide presupuesto', href: '/contacto/' },
  /** Datos de contacto del pie. Déjalos vacíos si no aplican. */
  contact: {
    phone: '985 000 000',
    phoneHref: 'tel:+34985000000',
    email: 'info@nortiareformas.example',
    address: 'Calle Ejemplo 12, bajo · 33201 Gijón (Asturias)',
    hours: 'L–J 8:00–14:00 y 16:00–19:00 · V 8:00–15:00',
  },
};
