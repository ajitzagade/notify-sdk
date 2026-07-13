import { Toast } from "@base-ui/react/toast"

/**
 * One global manager instance — created outside React so any module (form
 * handlers, panels, etc.) can call toast.success()/toast.error() directly
 * without needing a hook. <Toaster/> (mounted once in layout.tsx) renders
 * whatever this manager holds via Toast.useToastManager().
 */
export const toastManager = Toast.createToastManager()

export const toast = {
  success: (description: string, title = "Success") =>
    toastManager.add({ type: "success", title, description, timeout: 4000 }),
  error: (description: string, title = "Something went wrong") =>
    toastManager.add({ type: "error", title, description, timeout: 6000 }),
}
