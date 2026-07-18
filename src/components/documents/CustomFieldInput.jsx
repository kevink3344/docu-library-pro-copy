import MultiSelectInput from './MultiSelectInput';

export default function CustomFieldInput({ field, value, onChange }) {
  if (field.input_type === 'text-short') {
    return <input value={value || ''} onChange={e => onChange(e.target.value)} className="kbb-input w-full" />;
  }
  if (field.input_type === 'text-paragraph') {
    return <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} className="kbb-input w-full resize-none" />;
  }
  if (field.input_type === 'single-select') {
    return (
      <select value={value || ''} onChange={e => onChange(e.target.value)} className="kbb-input w-full">
        <option value="">— Select —</option>
        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.input_type === 'multi-select') {
    return <MultiSelectInput options={field.options || []} value={Array.isArray(value) ? value : []} onChange={onChange} />;
  }
  return null;
}