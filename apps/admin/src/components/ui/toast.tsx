"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const toastVariants = cva(
  "group/toast relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all data-[starting-style]:translate-x-2 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
  {
    variants: {
      type: {
        default: "border-border bg-popover text-popover-foreground",
        success: "border-signal/30 bg-signal/10 text-foreground",
        error: "border-destructive/30 bg-destructive/10 text-foreground",
      },
    },
    defaultVariants: { type: "default" },
  }
)

const ToastProvider = ToastPrimitive.Provider

function ToastPortal(props: React.ComponentProps<typeof ToastPrimitive.Portal>) {
  return <ToastPrimitive.Portal {...props} />
}

function ToastViewport({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed bottom-4 right-4 z-100 flex w-full max-w-sm flex-col-reverse gap-2 outline-none",
        className
      )}
      {...props}
    />
  )
}

function ToastRoot({
  className,
  toast,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>) {
  const type = (["default", "success", "error"] as const).includes(toast.type as never)
    ? (toast.type as "default" | "success" | "error")
    : "default"
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      toast={toast}
      className={cn(toastVariants({ type }), className)}
      {...props}
    />
  )
}

function ToastContent({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Content>) {
  return (
    <ToastPrimitive.Content data-slot="toast-content" className={cn("grid flex-1 gap-1", className)} {...props} />
  )
}

function ToastTitle({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn("text-sm font-semibold leading-none", className)}
      {...props}
    />
  )
}

function ToastDescription({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function ToastClose({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      aria-label="Close"
      className={cn(
        "shrink-0 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
      {...props}
    >
      <X className="size-3.5" />
    </ToastPrimitive.Close>
  )
}

export {
  ToastProvider,
  ToastPortal,
  ToastViewport,
  ToastRoot,
  ToastContent,
  ToastTitle,
  ToastDescription,
  ToastClose,
}
