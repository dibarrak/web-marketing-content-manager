import { Search, Heart, Settings, X, Check, AlertCircle } from 'lucide-react';

export default function IconShowcase() {
  return (
    <div style={{ padding: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <Search size={24} />
      <Heart size={24} />
      <Settings size={24} />
      <X size={24} />
      <Check size={24} />
      <AlertCircle size={24} />
    </div>
  );
}
