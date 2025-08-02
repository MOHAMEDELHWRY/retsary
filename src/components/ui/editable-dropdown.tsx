"use client";

import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { descriptionOptions, addNewDescription, loadCustomDescriptions } from '@/data/transaction-data';

interface EditableDropdownProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function EditableDropdown({ 
  value = '', 
  onValueChange, 
  placeholder = 'اختر أو أضف جديد...',
  className 
}: EditableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load options on component mount
  useEffect(() => {
    loadCustomDescriptions();
    setOptions([...descriptionOptions]);
  }, []);

  // Focus input when showing add new section
  useEffect(() => {
    if (showAddNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showAddNew]);

  const handleAddNew = () => {
    if (newValue.trim() && !options.includes(newValue.trim())) {
      addNewDescription(newValue.trim());
      setOptions([...descriptionOptions]);
      onValueChange(newValue.trim());
      setNewValue('');
      setShowAddNew(false);
      setOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNew();
    } else if (e.key === 'Escape') {
      setShowAddNew(false);
      setNewValue('');
    }
  };

  // Filter options based on search
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {value || placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="بحث في شركات الأسمنت..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2">
                <p className="text-sm text-muted-foreground mb-2">
                  لا توجد نتائج. هل تريد إضافة شركة جديدة؟
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddNew(true);
                    setNewValue(searchValue);
                  }}
                  className="w-full"
                >
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة "{searchValue}"
                </Button>
              </div>
            </CommandEmpty>
            
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onValueChange(option);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
              
              {!showAddNew && filteredOptions.length > 0 && (
                <CommandItem
                  onSelect={() => setShowAddNew(true)}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  إضافة شركة أسمنت جديدة
                </CommandItem>
              )}
            </CommandGroup>

            {showAddNew && (
              <div className="p-3 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-medium">إضافة شركة أسمنت جديدة</label>
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="اكتب اسم الشركة..."
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleAddNew}
                      disabled={!newValue.trim() || options.includes(newValue.trim())}
                    >
                      إضافة
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddNew(false);
                      setNewValue('');
                    }}
                    className="w-full"
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
