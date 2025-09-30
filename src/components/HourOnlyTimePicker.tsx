import React from 'react';
import { Clock } from 'lucide-react';

interface HourOnlyTimePickerProps {
  value: string; // Format: "HH:00" (e.g., "07:00")
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
  // Generate 24 hourly options
  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour24 = i.toString().padStart(2, '0');
    const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
    const ampm = i < 12 ? 'AM' : 'PM';
    
    return {
      value: `${hour24}:00`,
      label: `${hour12}:00 ${ampm}`,
      display: `${hour12}:00 ${ampm}`
    };
  });

  const selectedOption = timeOptions.find(option => option.value === value);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Clock className="h-4 w-4 text-gray-400" />
        </div>
        
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:bg-gray-800 disabled:cursor-not-allowed appearance-none"
        >
          <option value="" disabled>
            Select hour
          </option>
          {timeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      
      <p className="text-xs text-gray-500">
        Reports run once per hour at the selected time
      </p>
      
      {selectedOption && (
        <p className="text-xs text-blue-400">
          Selected: {selectedOption.display} EST
        </p>
      )}
    </div>
  );
};