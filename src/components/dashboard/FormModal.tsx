import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { X } from 'lucide-react';
import styles from './dashboard.module.scss';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function FormModal({ title, onClose, children }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const card = cardRef.current;
    if (!backdrop || !card) return;
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
    gsap.fromTo(
      card,
      { scale: 0.92, opacity: 0, y: 16 },
      { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' },
    );
  }, []);

  const handleClose = () => {
    const backdrop = backdropRef.current;
    const card = cardRef.current;
    if (!backdrop || !card) {
      onClose();
      return;
    }
    gsap.to(card, { scale: 0.92, opacity: 0, y: 16, duration: 0.2, ease: 'power2.in' });
    gsap.to(backdrop, { opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: onClose });
  };

  return createPortal(
    <div
      ref={backdropRef}
      className={styles.modal}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div ref={cardRef} className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <h2>{title}</h2>
          <button type="button" className={styles.modalCloseBtn} onClick={handleClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
