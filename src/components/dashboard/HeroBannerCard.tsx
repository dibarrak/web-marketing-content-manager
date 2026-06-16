import type { WebflowItem } from "@lib/api-client";
import { ExternalLink, EyeOff, EyeClosed, Eye, GlobeCheck, ZoomIn, X } from 'lucide-react';
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import styles from "./collectionCard.module.scss";

type AnyFields = Record<string, unknown> & { name: string; slug: string };

interface Props {
  item: WebflowItem<AnyFields>;
  onEdit: (item: WebflowItem<AnyFields>) => void;
  onDelete: (item: WebflowItem<AnyFields>) => void;
  onDuplicate: (item: WebflowItem<AnyFields>) => void;
  deletingId?: string;
}

type StatusKey = "active" | "inactive" | "hidden";

const STATUS_LABELS: Record<StatusKey, string> = {
  active: "Activo",
  inactive: "Inactivo",
  hidden: "Oculto",
};

function getStatus(display: string | undefined): StatusKey {
  if (!display || display === "hidden") return "hidden";
  const m =
    /^\[(\d{2})\/(\d{2})\/(\d{4})\] - \[(\d{2})\/(\d{2})\/(\d{4})\]$/.exec(
      display,
    );
  if (!m) return "inactive";
  const [, d1, mo1, y1, d2, mo2, y2] = m;
  const start = new Date(+y1, +mo1 - 1, +d1);
  const end = new Date(+y2, +mo2 - 1, +d2, 23, 59, 59, 999);
  const now = new Date();
  return now >= start && now <= end ? "active" : "inactive";
}

function RichText({ value }: { value: unknown }) {
  if (typeof value !== "string" || !value.trim()) return <span>—</span>;
  return (
    <div
      className={styles.richText}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}

function str(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  return value.trim();
}

// Extracts a hex color from plain "#RRGGBB" or structured "{h1|h2, #RRGGBB}" formats
function extractHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /#[0-9a-fA-F]{6}/.exec(value);
  return m ? m[0] : null;
}

function UrlField({ value }: { value: unknown }) {
  const url = str(value);
  return (
    <p className={styles.urlRow}>
      <span title={url !== '—' ? url : undefined}>{url}</span>
      {url !== '—' && (
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.urlLink}>
          <ExternalLink size={16} strokeWidth={3} />
        </a>
      )}
    </p>
  );
}

const GRADIENT_MAP: Record<string, string> = {
  'Variante 1 - Naranja':
    'linear-gradient(45deg, rgba(249,115,116,1) 0%, rgba(239,103,114,1) 35%, rgba(198,61,111,1) 100%)',
  'Variante 2 - Azul':
    'linear-gradient(272.41deg, #0a1e3f -5%, #15406c 3.07%, #37adfd 26.87%, #00508f 70.85%)',
  'Variante 3 - Cian-Cobalto':
    'linear-gradient(95.32deg, #0777ff 44.71%, #1fd198 100%)',
  'Variante 4 - Acero-Glacial':
    'linear-gradient(110.42deg, #bbd1e9 11.91%, #abaeb3 53.57%, rgb(143,143,143) 74.01%)',
  'Variante 5 - La vida no espera':
    'linear-gradient(95.32deg, #0777ff 44.71%, #3df15c 100%)',
};

function GradientPreview({ value }: { value: unknown }) {
  const name = str(value);
  const gradient = GRADIENT_MAP[name];
  if (!gradient) {
    return <span className={`${styles.colorPreview} ${styles.noColor}`} />;
  }
  return <span className={styles.colorPreview} style={{ backgroundImage: gradient }} />;
}

function ImageZoomModal({ src, onClose }: { src: string; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const img = imgRef.current;
    if (!backdrop || !img) return;
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
    gsap.fromTo(img, { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.5)' });
  }, []);

  const handleClose = () => {
    const backdrop = backdropRef.current;
    const img = imgRef.current;
    if (!backdrop || !img) { onClose(); return; }
    gsap.to(img, { scale: 0.88, opacity: 0, duration: 0.2, ease: 'power2.in' });
    gsap.to(backdrop, { opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: onClose });
  };

  return createPortal(
    <div ref={backdropRef} className={styles.imageModal} onClick={handleClose}>
      <button type="button" className={styles.imageModalClose} onClick={handleClose} aria-label="Cerrar">
        <X size={20} />
      </button>
      <img
        ref={imgRef}
        src={src}
        alt="Vista completa"
        className={styles.imageModalImg}
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

function ImagePreview({ value, alt, onZoom }: { value: unknown; alt: string; onZoom: (url: string) => void }) {
  if (typeof value === "string" && value.trim()) {
    return (
      <div className={styles.imagePreviewWrap}>
        <img src={value} alt={alt} loading="lazy" className={styles.bannerImageThumb} />
        <button
          type="button"
          className={styles.imageZoomBtn}
          onClick={() => onZoom(value)}
          aria-label="Ver imagen completa"
        >
          <ZoomIn size={16} />
        </button>
      </div>
    );
  }
  return <span className={`${styles.bannerImageThumb} ${styles.noImage}`} />;
}

function ColorPreview({ value }: { value: unknown }) {
  const hex = extractHex(value);
  if (!hex) {
    return <span className={`${styles.colorPreview} ${styles.noColor}`} />;
  }
  return (
    <span className={styles.colorPreview} style={{ backgroundColor: hex }} />
  );
}

export default function HeroBannerCard({
  item,
  onEdit,
  onDelete,
  onDuplicate,
  deletingId,
}: Props) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const f = item.fieldData;
  const display =
    typeof f["fechas-despliegue"] === "string"
      ? f["fechas-despliegue"]
      : undefined;
  const status = getStatus(display);
  const lastUpdated = item.lastUpdated
    ? new Date(item.lastUpdated).toLocaleString("es-MX")
    : "—";
  const displayText =
    display && display !== "hidden" ? display.replace(/[\[\]]/g, "") : null;
  const showCreateBtn =
    f["mostrar-boton-creacion-cuenta"] === true
      ? "Mostrar"
      : f["mostrar-boton-creacion-cuenta"] === false
        ? "No mostrar"
        : "—";

  return (
    <div className={styles.item}>
      <div className={styles.wrapper}>
        <div className={styles.body}>
          <div className={`${styles.row} ${styles.alignStart}`}>
            {/* Left column — content, colors, images */}
            <div className={styles.textBlock}>
              <span className={styles.label}>Título</span>
              <div>
                <RichText value={f["titulo"]} />
              </div>

              <span className={styles.label}>Descripción</span>
              <div>
                <RichText value={f["descripcion"]} />
              </div>

              <span className={styles.label}>Descripción auxiliar</span>
              <div>
                <RichText value={f["texto-descripcion-auxiliar"]} />
              </div>

              <span className={styles.label}>Texto auxiliar</span>
              <div>
                <RichText value={f["texto-copy-auxiliar"]} />
              </div>

              <span className={styles.label}>Texto disclaimer</span>
              <div>
                <RichText value={f["texto-disclaimer"]} />
              </div>

              {/* Color grid */}
              <div className={styles.colorGrid}>
                <div className={styles.colorItem}>
                  <span className={styles.label}>Color de fondo</span>
                  <p>{str(f["color-fondo-2"])}</p>
                  <ColorPreview value={f["color-fondo-2"]} />
                </div>
                <div className={styles.colorItem}>
                  <span className={styles.label}>Texto alterno</span>
                  <p>{str(f["color-texto-alterno"])}</p>
                  <ColorPreview value={f["color-texto-alterno"]} />
                </div>
                <div className={styles.colorItem}>
                  <span className={styles.label}>Gradiente</span>
                  <p>{str(f["variante-de-gradiente"])}</p>
                  <GradientPreview value={f["variante-de-gradiente"]} />
                </div>
              </div>

              {/* Image thumbnails */}
              <div className={styles.bannerImages}>
                <div className={styles.bannerImage}>
                  <span className={styles.label}>Imagen desktop</span>
                  <ImagePreview value={f["imagen-2"]} alt="Desktop" onZoom={setZoomedImage} />
                </div>
                <div className={styles.bannerImage}>
                  <span className={styles.label}>Imagen mobile</span>
                  <ImagePreview value={f["imagen-mobile"]} alt="Mobile" onZoom={setZoomedImage} />
                </div>
                <div className={styles.bannerImage}>
                  <span className={styles.label}>Logo</span>
                  <ImagePreview value={f["logo-de-merchant"]} alt="Logo" onZoom={setZoomedImage} />
                </div>
              </div>
            </div>

            {/* Right column — operational data */}
            <div className={`${styles.metaBlock} ${styles.bannerMeta}`}>
              <span className={styles.label}>Sitio de destino</span>
              <p className={styles.siteTargetWrapper}>
                <span className={styles.siteTarget}>
                  {str(f["pagina-despliegue"])}
                </span>
                <GlobeCheck size={16} />
              </p>

              <span className={styles.label}>Display</span>
              {!display || display === "hidden" ? (
                <p>
                  <span
                    className={`${styles.displayBadge} ${styles.displayHidden}`}
                  >
                    Oculto
                  </span>
                </p>
              ) : (
                <p className={styles.displayRange}>{displayText}</p>
              )}

              <span className={styles.label}>Nombre de banner</span>
              <p>{f.name}</p>

              <span className={styles.label}>Slug de Webflow</span>
              <p>{f.slug}</p>

              {/* Button details */}
              <div className={styles.buttonGroups}>
                <div className={styles.buttonGroup}>
                  <span className={styles.label}>Botón de creación</span>
                  <p>{str(f["copy-personalizado-boton-creacion-cuenta"])}</p>
                  <span className={styles.label}>URL</span>
                  <UrlField value={f["url-personalizada-boton-creacion-cuenta"]} />
                  <span className={styles.label}>¿Mostrar?</span>
                  <p>{showCreateBtn}</p>
                  <span className={styles.label}>Variante</span>
                  <p>{str(f["variante-boton-creacion-cuenta"])}</p>
                </div>
                <div className={styles.buttonGroup}>
                  <span className={styles.label}>Botón adicional</span>
                  <p>{str(f["copy-boton-extra"])}</p>
                  <span className={styles.label}>URL</span>
                  <UrlField value={f["url-boton-extra"]} />
                  <span className={styles.label}>Variante</span>
                  <p>{str(f["variante-boton-extra"])}</p>
                </div>
              </div>

              <span className={styles.label}>Última modificación</span>
              <p>{lastUpdated}</p>

              <div className={styles.bannerActions}>
                <button
                  type="button"
                  className={styles.duplicateBtn}
                  onClick={() => onDuplicate(item)}
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => onEdit(item)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => onDelete(item)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? "…" : "Borrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vertical status badge on the right edge */}
      <div className={`${styles.sideStatus} ${styles[status]}`}>
        {STATUS_LABELS[status]}
      </div>

      {zoomedImage && (
        <ImageZoomModal src={zoomedImage} onClose={() => setZoomedImage(null)} />
      )}
    </div>
  );
}
