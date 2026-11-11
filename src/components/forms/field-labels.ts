/**
 * Human-friendly labels for the CMS field slugs across the 3 flows. Used by
 * FormErrorSummary so non-technical users see "Color de fondo" instead of
 * `color-fondo-2`.
 */
export const FIELD_LABELS: Record<string, string> = {
  // Shared
  name: 'Name',
  slug: 'Slug',

  // Coupons / Coupon Filter Lists
  'coupon-title': 'Coupon title',
  'coupon-description': 'Coupon description',
  'coupon-validity-text': 'Coupon validity text',
  'related-merchants': 'Related merchants',
  'coupon-display': 'Coupon display',

  // Hero banners
  titulo: 'Título',
  descripcion: 'Descripción',
  'imagen-2': 'Imagen (principal)',
  'fechas-despliegue': 'Fechas despliegue',
  'pagina-despliegue': 'Página despliegue',
  'imagen-cabecera': 'Imagen cabecera',
  'imagen-mobile': 'Imagen mobile',
  'texto-descripcion-auxiliar': 'Texto descripción auxiliar',
  'texto-copy-auxiliar': 'Texto copy auxiliar',
  'texto-disclaimer': 'Texto disclaimer',
  'mostrar-boton-creacion-cuenta': 'Mostrar botón de creación de cuenta',
  'copy-personalizado-boton-creacion-cuenta': 'Copy personalizado del botón de creación de cuenta',
  'url-personalizada-boton-creacion-cuenta': 'URL personalizada del botón de creación de cuenta',
  'variante-boton-creacion-cuenta': 'Variante del botón de creación de cuenta',
  'copy-boton-extra': 'Copy del botón extra',
  'url-boton-extra': 'URL del botón extra',
  'variante-boton-extra': 'Variante del botón extra',
  'color-fondo-2': 'Color de fondo',
  'color-texto-alterno': 'Color de texto alterno',
  'slide-order': 'Orden del slide',
  'logo-de-merchant': 'Logo del merchant',
  'texto-alterno-logo-merchant': 'Texto alterno del logo del merchant',
  'variante-de-gradiente': 'Variante de gradiente',
  'imagen-intermedia': 'Imagen intermedia',
  'texto-alternativo-imagen-intermedia': 'Texto alternativo de la imagen intermedia',
  'ancho-maximo-imagen-intermedia': 'Ancho máximo de la imagen intermedia',
  'alto-maximo-imagen-intermedia': 'Alto máximo de la imagen intermedia',
  'imagen-de-esquina': 'Imagen de esquina',
  'texto-alternativo-imagen-de-esquina': 'Texto alternativo de la imagen de esquina',
  'posicion-imagen-de-esquina': 'Posición de la imagen de esquina',
  'ancho-maximo-imagen-de-esquina': 'Ancho máximo de la imagen de esquina',
  'alto-maximo-imagen-de-esquina': 'Alto máximo de la imagen de esquina',

  // Comercios destacados por categoría
  orden: 'Orden',
  'nombre-del-comercio': 'Nombre del comercio',
  categoria: 'Categoría',
  'tipo-de-comercio': 'Tipo de comercio',

  // Automatized Ad Banners
  title: 'Título',
  body: 'Cuerpo',
  href: 'Enlace (URL)',
  'image-2': 'Imagen',
  'image-alt': 'Texto alternativo de la imagen',
  'image-wide': 'Imagen ancha',
  'logo-2': 'Logo',
  'logo-alt': 'Texto alternativo del logo',
  coupon: 'Cupón',
  'coupon-label': 'Etiqueta del cupón',
  cta: 'CTA',
  track: 'Track',
  'new-tab': 'Abrir en pestaña nueva',
  'show-dates': 'Fechas de vigencia',
  'site-target': 'Sitios de destino',
};

export function labelFor(slug: string): string {
  return FIELD_LABELS[slug] ?? slug;
}
