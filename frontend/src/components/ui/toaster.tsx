import { useToast } from "@/hooks/use-toast";
import { ToastProvider, ToastViewport, Toast } from "@/components/ui/toast";
import { MakeryToastLayout } from "@/components/ui/makery-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, status, ...props }) {
        return (
          <Toast key={id} {...props} className="border-none bg-transparent p-0 shadow-none w-auto max-w-[420px]">
            <MakeryToastLayout
              status={status || "default"}
              title={typeof title === "string" ? title : undefined}
              description={typeof description === "string" ? description : undefined}
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
