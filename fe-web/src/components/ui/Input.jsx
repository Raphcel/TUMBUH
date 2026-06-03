import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCloseOnScroll } from '../../hooks/useCloseOnScroll';

const MotionDiv = motion.div;

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[#0A1D3D]/80 mb-1">
          {label}
        </label>
      )}
      <input
        className={`w-full rounded-lg px-3 py-2 text-sm disabled:bg-[#E6ECF5] disabled:text-[#0A1D3D]/50 shadow-sm border ${error
          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
          : 'border-none'
          } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function Select({ label, error, options = [], className = '', value, onChange, placeholder = 'Select an option', ...props }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  // Update coordinates when opening the dropdown
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useCloseOnScroll(isOpen, () => setIsOpen(false), dropdownRef);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    // Mimic the event object that a native select would return
    const syntheticEvent = {
      target: {
        name: props.name,
        value: optionValue
      }
    };
    if (onChange) {
      onChange(syntheticEvent);
    }
    setSearchTerm('');
    setActiveIndex(0);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === value);
  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return options;

    return options
      .filter((opt) => opt.label.toLowerCase().includes(term))
      .sort((a, b) => {
        const aStarts = a.label.toLowerCase().startsWith(term);
        const bStarts = b.label.toLowerCase().startsWith(term);
        if (aStarts === bStarts) return a.label.localeCompare(b.label);
        return aStarts ? -1 : 1;
      });
  }, [options, searchTerm]);

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, filteredOptions.length - 1));

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter' && filteredOptions[safeActiveIndex]) {
      event.preventDefault();
      handleSelect(filteredOptions[safeActiveIndex].value);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="w-full relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-[#0A1D3D]/80 mb-1">
          {label}
        </label>
      )}

      <div
        className={`w-full bg-white rounded-lg border px-3 py-2 text-sm shadow-sm cursor-pointer flex justify-between items-center transition-all duration-200 ${error
          ? 'border-red-300 focus:ring-red-500'
          : isOpen
            ? 'border-primary ring-1 ring-primary/20'
            : 'border-[#E6ECF5] hover:border-[#1E3A8A]'
          } ${className}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`${!selectedOption ? 'text-[#0A1D3D]/50' : 'text-[#0A1D3D]'} truncate`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-[#0A1D3D]/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </div>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: coords.top + 4, // Add a small gap
            left: coords.left,
            width: coords.width,
            zIndex: 9999
          }}
        >
          <AnimatePresence>
            <MotionDiv
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg shadow-lg border border-[#E6ECF5] py-1 max-h-60 overflow-auto focus:outline-none"
              onWheel={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 border-b border-[#E6ECF5] bg-white p-2">
                <input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  onClick={(event) => event.stopPropagation()}
                  placeholder="Type to search..."
                  className="w-full rounded-md border border-[#E6ECF5] px-2.5 py-1.5 text-sm text-[#0A1D3D] outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, index) => (
                  <div
                    key={opt.value}
                    className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors ${value === opt.value || index === safeActiveIndex
                      ? 'bg-primary/5 text-primary font-medium'
                      : 'text-[#0A1D3D]/80 hover:bg-[#E6ECF5]'
                      }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <span className="truncate">{opt.label}</span>
                    {value === opt.value && (
                      <Check size={14} className="text-primary flex-shrink-0 ml-2" />
                    )}
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-[#0A1D3D]/40 text-center">
                  No matches
                </div>
              )}
            </MotionDiv>
          </AnimatePresence>
        </div>,
        document.body
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
