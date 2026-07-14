"use client"

import { Toast } from "@base-ui/react/toast"
import {
  ToastClose,
  ToastContent,
  ToastDescription,
  ToastIcon,
  ToastPortal,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { toastManager } from "@/lib/toast"

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((t) => (
    <ToastRoot key={t.id} toast={t}>
      <ToastIcon type={t.type} />
      <ToastContent>
        {t.title && <ToastTitle>{t.title}</ToastTitle>}
        {t.description && <ToastDescription>{t.description}</ToastDescription>}
      </ToastContent>
      <ToastClose />
    </ToastRoot>
  ))
}

export function Toaster({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider toastManager={toastManager}>
      {children}
      <ToastPortal>
        <ToastViewport>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  )
}
