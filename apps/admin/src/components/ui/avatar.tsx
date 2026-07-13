"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@/lib/utils"

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-lg", className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("size-full object-cover", className)}
      {...props}
    />
  )
}

/** `color` sets the fallback's background — pass a tenant's brand color for a deterministic, on-brand initial badge. */
function AvatarFallback({
  className,
  color,
  style,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback> & { color?: string | null }) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("flex size-full items-center justify-center text-xs font-semibold text-white", className)}
      style={{ background: color ?? "var(--muted-foreground)", ...style }}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
