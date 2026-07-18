import { useState } from 'react';
import { X } from 'lucide-react';

export default function TagInput({ value = [], onChange, placeholder = 'Add tag and press Enter...' }) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag) => onChange(value.filter(t => t !== tag));

  return (
    <div className="kbb-input w-full min-h-[38px] flex flex-wrap gap-1.5 items-center cursor-text" onClick={() => document.getElementById('tag-input')?.focus()}>
      {value.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-primary/8 text-primary border border-primary/20" style={{ borderRadius: 2 }}>
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        id="tag-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
          if (e.key === 'Backspace' && !input && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] bg-transparent outline-none text-sm"
      />
    </div>
  );
}