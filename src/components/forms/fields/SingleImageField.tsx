import ImageDropzone, { type UploadedImage } from './ImageDropzone';

interface Props {
  label: string;
  collectionId: string;
  value: string;
  onChange: (url: string) => void;
  maxDimension?: number;
  required?: boolean;
  error?: string;
  help?: string;
}

/**
 * Hero Banner stores image URLs as PlainText fields in Webflow. This adapter
 * wraps ImageDropzone (which talks in {url, alt}[] for symmetry with MultiImage)
 * and emits a single URL string.
 */
export default function SingleImageField({ value, onChange, ...rest }: Props) {
  const arr: UploadedImage[] = value ? [{ url: value, alt: '' }] : [];
  return (
    <ImageDropzone
      {...rest}
      value={arr}
      multiple={false}
      onChange={(next) => onChange(next[0]?.url ?? '')}
    />
  );
}
