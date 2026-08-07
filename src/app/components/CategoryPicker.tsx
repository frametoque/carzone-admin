"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

interface CategoryPickerProps {
  categories: string[];
  value: string[];
  onChange: (selected: string[]) => void;
  onAddCategory?: (newCat: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function CategoryPicker({
  categories,
  value,
  onChange,
  onAddCategory,
  disabled = false,
  placeholder = "Select categories...",
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [newCatName, setNewCatName] = useState("");
  
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position the portal dropdown under the trigger button
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 300; // Fixed max height for safety

    if (spaceBelow >= dropdownHeight) {
      // Open downward
      setDropdownStyle({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    } else {
      // Open upward
      setDropdownStyle({
        top: rect.top + window.scrollY - dropdownHeight - 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setOpen((o) => !o);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reposition on scroll / resize
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open]);

  const toggle = (cat: string) => {
    onChange(value.includes(cat) ? value.filter((c) => c !== cat) : [...value, cat]);
  };

  const remove = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((c) => c !== cat));
  };

  const handleAdd = () => {
    const name = newCatName.trim();
    if (!name) return;

    if (!categories.includes(name)) {
      if (onAddCategory) {
        onAddCategory(name);
      }
    }

    if (!value.includes(name)) {
      onChange([...value, name]);
    }

    setNewCatName("");
  };

  const filteredCategories = categories.filter((cat) =>
    cat.toLowerCase().includes(newCatName.toLowerCase())
  );

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={{ ...dropdownStyle, position: "absolute", zIndex: 9999 }}
      className="bg-[#ffffff] border border-[#cbd5e1] rounded-xl shadow-2xl overflow-hidden max-h-[300px] flex flex-col"
    >
      {/* Search / Add Category block */}
      <div className="p-2 border-b border-[#cbd5e1] flex items-center gap-2 bg-[#f8fafc] flex-shrink-0">
        <input
          type="text"
          placeholder="Search or add category..."
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          className="flex-1 bg-[#ffffff] border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs text-[#0f172a] outline-none focus:border-[#002f4c] placeholder-[#94a3b8]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="bg-[#002f4c] hover:bg-[#0a3350] text-[#ffffff] font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors active:scale-95 cursor-pointer"
        >
          Add
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {filteredCategories.map((cat) => {
          const selected = value.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onMouseDown={(e) => e.preventDefault()} 
              onClick={() => toggle(cat)}
              className={`w-full text-left px-4 py-2.5 text-xs flex items-center gap-3 transition-colors hover:bg-[#f1f5f9] cursor-pointer ${
                selected ? "text-[#002f4c] font-semibold bg-[#e0f2fe]" : "text-[#334155]"
              }`}
            >
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  selected ? "bg-[#002f4c] border-[#002f4c]" : "border-[#cbd5e1] bg-[#ffffff]"
                }`}
              >
                {selected && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
                    <path d="M1 4l2.5 2.5L9 1" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {cat}
            </button>
          );
        })}
        {filteredCategories.length === 0 && (
          <p className="text-[#94a3b8] text-[10px] text-center py-4">No categories found. Type above to add!</p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="w-full min-h-[42px] bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-brand-500 transition-colors disabled:opacity-50 flex items-center gap-2 flex-wrap text-left text-white"
      >
        {value.length === 0 ? (
          <span className="text-gray-500 text-sm">{placeholder}</span>
        ) : (
          value.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-400 text-xs font-semibold"
            >
              {cat}
              {!disabled && (
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={(e) => remove(cat, e)} />
              )}
            </span>
          ))
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-400 ml-auto flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Portal: renders outside any overflow:hidden parent */}
      {typeof document !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </>
  );
}