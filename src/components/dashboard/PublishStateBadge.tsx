import type { WebflowItem } from '@lib/api-client';
import { getPublishState, PUBLISH_STATE_LABELS } from '@lib/publish-state';
import { CircleCheck, PencilLine } from 'lucide-react';
import styles from './collectionCard.module.scss';

/**
 * Pill showing whether the item is live in the Webflow CMS or still a draft.
 * Rendered in the metadata column so it never competes with a card's side ribbon
 * (which tracks date-range visibility, a different thing).
 */
export default function PublishStateBadge({
  item,
}: {
  item: Pick<WebflowItem, 'isDraft' | 'lastPublished'>;
}) {
  const state = getPublishState(item);
  const publishedAt = item.lastPublished
    ? new Date(item.lastPublished).toLocaleString('es-MX')
    : null;

  return (
    <span
      className={`${styles.publishState} ${styles[state]}`}
      title={
        state === 'published' && publishedAt
          ? `Publicado en el CMS el ${publishedAt}`
          : 'Sin publicar en el CMS'
      }
    >
      {state === 'published' ? <CircleCheck size={12} /> : <PencilLine size={12} />}
      {PUBLISH_STATE_LABELS[state]}
    </span>
  );
}
