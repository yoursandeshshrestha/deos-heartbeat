"use client"

import { useControllableState } from "@radix-ui/react-use-controllable-state"
import {
  CaretUpDown as ChevronsUpDownIcon,
  Plus as PlusIcon,
} from '@phosphor-icons/react'
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { triggerFieldButtonClassName } from "@/components/ui/field-styles"

interface ComboboxData {
  label: string
  value: string
}

interface ComboboxContextType {
  data: readonly ComboboxData[]
  type: string
  value: string
  onValueChange: (value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  width: number
  setWidth: (width: number) => void
  inputValue: string
  setInputValue: (value: string) => void
}

const ComboboxContext = createContext<ComboboxContextType>({
  data: [],
  type: "item",
  value: "",
  onValueChange: () => {},
  open: false,
  onOpenChange: () => {},
  width: 200,
  setWidth: () => {},
  inputValue: "",
  setInputValue: () => {},
})

export type ComboboxProps = ComponentProps<typeof Popover> & {
  data: readonly ComboboxData[]
  type: string
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const Combobox = ({
  data,
  type,
  defaultValue,
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  ...props
}: ComboboxProps) => {
  const [value, onValueChange] = useControllableState({
    defaultProp: defaultValue ?? "",
    prop: controlledValue,
    onChange: controlledOnValueChange,
  })
  const [open, onOpenChange] = useControllableState({
    defaultProp: defaultOpen,
    prop: controlledOpen,
    onChange: controlledOnOpenChange,
  })
  const [width, setWidth] = useState(200)
  const [inputValue, setInputValue] = useState("")

  return (
    <ComboboxContext.Provider
      value={{
        type,
        value,
        onValueChange,
        open,
        onOpenChange,
        data,
        width,
        setWidth,
        inputValue,
        setInputValue,
      }}
    >
      <Popover {...(props as any)} onOpenChange={onOpenChange} open={open} />
    </ComboboxContext.Provider>
  )
}

export type ComboboxTriggerProps = ComponentProps<typeof Button>

export const ComboboxTrigger = ({ children, className, ...props }: ComboboxTriggerProps) => {
  const { value, data, type, setWidth } = useContext(ComboboxContext)
  const ref = useRef<HTMLButtonElement>(null)
  const selectedLabel = value
    ? data.find((item) => item.value === value)?.label ?? value
    : null

  useEffect(() => {
    // Create a ResizeObserver to detect width changes
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const newWidth = (entry.target as HTMLElement).offsetWidth
        if (newWidth) {
          setWidth?.(newWidth)
        }
      }
    })

    if (ref.current) {
      resizeObserver.observe(ref.current)
    }

    // Clean up the observer when component unmounts
    return () => {
      resizeObserver.disconnect()
    }
  }, [setWidth])

  return (
    <PopoverTrigger asChild>
      <Button variant="outline" className={cn(triggerFieldButtonClassName, className)} {...(props as any)} ref={ref}>
        {children ?? (
          // `min-w-0` on the row + truncating inner span is required because
          // the parent `Button` has `whitespace-nowrap`, so without an
          // explicit shrinkable child the selected label (e.g. a voice UUID
          // before the voices list finishes loading, or any long item name)
          // pushes the chevron out of the column. The outer span keeps the
          // chevron right-aligned via justify-between; the inner span clips
          // with an ellipsis.
          <span className="flex w-full min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-left">
              {selectedLabel ?? `Select ${type}...`}
            </span>
            <ChevronsUpDownIcon className="shrink-0 text-muted-foreground" size={16} />
          </span>
        )}
      </Button>
    </PopoverTrigger>
  )
}

export type ComboboxContentProps = ComponentProps<typeof Command> & {
  popoverOptions?: ComponentProps<typeof PopoverContent>
}

export const ComboboxContent = ({ className, popoverOptions, ...props }: ComboboxContentProps) => {
  const { width } = useContext(ComboboxContext)

  return (
    <PopoverContent
      className={cn("max-h-(--radix-popover-content-available-height) overflow-hidden p-0", className)}
      style={{ width }}
      {...popoverOptions}
    >
      <Command {...(props as any)} />
    </PopoverContent>
  )
}

export type ComboboxInputProps = ComponentProps<typeof CommandInput> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export const ComboboxInput = ({
  value: controlledValue,
  defaultValue,
  onValueChange: controlledOnValueChange,
  ...props
}: ComboboxInputProps) => {
  const { type, inputValue, setInputValue } = useContext(ComboboxContext)

  const [value, onValueChange] = useControllableState({
    defaultProp: defaultValue ?? inputValue,
    prop: controlledValue,
    onChange: newValue => {
      // Sync with context state
      setInputValue(newValue)
      // Call external onChange if provided
      controlledOnValueChange?.(newValue)
    },
  })

  return (
    <CommandInput
      onValueChange={onValueChange}
      placeholder={`Search ${type}...`}
      value={value}
      {...(props as any)}
    />
  )
}

export type ComboboxListProps = ComponentProps<typeof CommandList>

export const ComboboxList = ({ className, onWheel, ...props }: ComboboxListProps) => (
  <CommandList
    className={cn("mt-1 max-h-[min(18rem,var(--radix-popover-content-available-height))]", className)}
    onWheel={(event) => {
      // Keep wheel scrolling inside the dropdown instead of bubbling to parent scroll containers.
      event.stopPropagation()
      onWheel?.(event)
    }}
    {...(props as any)}
  />
)

export type ComboboxEmptyProps = ComponentProps<typeof CommandEmpty>

export const ComboboxEmpty = ({ children, ...props }: ComboboxEmptyProps) => {
  const { type } = useContext(ComboboxContext)

  return <CommandEmpty {...(props as any)}>{children ?? `No ${type} found.`}</CommandEmpty>
}

export type ComboboxGroupProps = ComponentProps<typeof CommandGroup>

export const ComboboxGroup = (props: ComboboxGroupProps) => <CommandGroup {...(props as any)} />

export type ComboboxItemProps = ComponentProps<typeof CommandItem> & {
  value: string
}

export const ComboboxItem = ({
  value: itemValue,
  className,
  ...props
}: ComboboxItemProps) => {
  const { value: selectedValue, onValueChange, onOpenChange } = useContext(ComboboxContext)
  const isSelected = selectedValue === itemValue

  return (
    <CommandItem
      {...(props as any)}
      value={itemValue}
      data-checked={isSelected}
      className={cn('cursor-pointer', className)}
      onMouseDown={(event) => {
        // Prevent the trigger from stealing focus before cmdk can select.
        event.preventDefault()
      }}
      onSelect={() => {
        onValueChange(itemValue)
        onOpenChange(false)
      }}
    />
  )
}

export type ComboboxSeparatorProps = ComponentProps<typeof CommandSeparator>

export const ComboboxSeparator = (props: ComboboxSeparatorProps) => (
  <CommandSeparator {...(props as any)} />
)

export interface ComboboxCreateNewProps {
  onCreateNew: (value: string) => void
  children?: (inputValue: string) => ReactNode
  className?: string
}

export const ComboboxCreateNew = ({ onCreateNew, children, className }: ComboboxCreateNewProps) => {
  const { inputValue, type, onValueChange, onOpenChange } = useContext(ComboboxContext)

  if (!inputValue.trim()) {
    return null
  }

  const handleCreateNew = () => {
    onCreateNew(inputValue.trim())
    onValueChange(inputValue.trim())
    onOpenChange(false)
  }

  return (
    <button
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-foreground/6 aria-selected:bg-foreground/6 aria-selected:text-accent-foreground dark:hover:bg-white/8 dark:aria-selected:bg-white/8 data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      onClick={handleCreateNew}
      type="button"
    >
      {children ? (
        children(inputValue)
      ) : (
        <>
          <PlusIcon className="h-4 w-4 text-muted-foreground" />
          <span>
            Create new {type}: "{inputValue}"
          </span>
        </>
      )}
    </button>
  )
}