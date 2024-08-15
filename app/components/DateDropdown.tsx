import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from "lucide-react";
import { formatDate } from '@/utils/chartUtils';

interface DateDropdownProps {
  selectedDate: string | null;
  setSelectedDate: (date: string) => void;
  dates: string[];
}

const DateDropdown: React.FC<DateDropdownProps> = ({
  selectedDate,
  setSelectedDate,
  dates
}) => {
  const [isOpen, setIsOpen] = useState(false);
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
  }, [dropdownRef]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className={`flex items-center justify-between w-32 px-3 py-2 text-sm font-medium text-gray-700 bg-white border ${isOpen ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm hover:bg-gray-50 focus:outline-none ${isOpen ? 'focus:ring-2 focus:ring-red-500 focus:ring-offset-2' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedDate ? formatDate(selectedDate) : 'Select Date'}
        <ChevronDown className="w-5 h-5 ml-2 -mr-1" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="absolute right-0 w-32 py-1 mt-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10 max-h-48 overflow-y-auto">
          {dates.map((date) => (
            <a
              key={date}
              href="#"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              style={{ color: date === selectedDate ? '#fe302f' : undefined }}
              onClick={(e) => {
                e.preventDefault();
                setSelectedDate(date);
                setIsOpen(false);
              }}
            >
              {formatDate(date)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default DateDropdown;