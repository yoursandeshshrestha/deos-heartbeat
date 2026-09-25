import * as React from "react"

import { cn } from "@/lib/utils"
import { textareaConstrainedClassName, textareaFieldClassName } from "@/components/ui/field-styles"

function Textarea({
  className,
  constrained = false,
  ...props
}: React.ComponentProps<"textarea"> & { constrained?: boolean }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(constrained ? textareaConstrainedClassName : textareaFieldClassName, className)}
      {...props}
    />
  )
}

export { Textarea }
