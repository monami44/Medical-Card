import React, { useRef, useEffect } from 'react';
import { ChevronDown } from "lucide-react";
import { NormalRangeKey } from '@/data/normalRanges';

interface ParameterDropdownProps {
  selectedParameter: NormalRangeKey;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  setSelectedParameter: (parameter: NormalRangeKey) => void;
  parameters: NormalRangeKey[];
}

const ParameterDropdown: React.FC<ParameterDropdownProps> = ({
  selectedParameter,
  isOpen,
  setIsOpen,
  setSelectedParameter,
  parameters,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setIsOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className={`flex items-center justify-between w-32 px-3 py-2 text-sm font-medium text-gray-700 bg-white border ${isOpen ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm hover:bg-gray-50 focus:outline-none ${isOpen ? 'focus:ring-2 focus:ring-red-500 focus:ring-offset-2' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedParameter}
        <ChevronDown className="w-5 h-5 ml-2 -mr-1" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="absolute right-0 w-32 py-1 mt-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10">
          {parameters.map((param) => (
            <a
              key={param}
              href="#"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              style={{ color: param === selectedParameter ? '#fe302f' : undefined }}
              onClick={(e) => {
                e.preventDefault();
                setSelectedParameter(param);
                setIsOpen(false);
              }}
            >
              {param}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParameterDropdown;