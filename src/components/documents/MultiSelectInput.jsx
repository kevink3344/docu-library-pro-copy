export default function MultiSelectInput({ options, value = [], onChange }) {
  const toggle = (opt) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt));
    else onChange([...value, opt]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1.5 text-sm border transition-colors ${
            value.includes(opt)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border hover:bg-accent text-foreground'
          }`}
          style={{ borderRadius: 2 }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}