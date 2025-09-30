import React from 'react';
import { Clock } from 'lucide-react';

interface HourOnlyTimePickerProps {
  value: string; // Format: "HH:00"
  onChange: (time: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const HourOnlyTimePicker: React.FC<HourOnlyTimePickerProps> = ({
  value,
  onChange,
  label = "Schedule Time",
  disabled = false,
  className = ""
}) => {
  // Generate 24 hour options
  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour24 = i.toString().padStart(2, '0');
    const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
    const ampm = i < 12 ? 'AM' : 'PM';
    
    return {
      value: `${hour24}:00`,
      label: `${hour12}:00 ${ampm}`,
      display: `${hour12}:00 ${ampm} (${hour24}:00)`
    };
  });

  const selectedOption = timeOptions.find(option => option.value === value);

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:bg-gray-800 disabled:cursor-not-allowed appearance-none"
        >
          {timeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.display}
            </option>
          ))}
        </select>
        
        {/* Custom dropdown arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 mt-1">
        Reports run on the hour in EST timezone
      </p>
    </div>
  );
};