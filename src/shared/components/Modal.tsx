import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@shared/lib/utils.js";
import type { HTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";

const modalVariants = cva(
  "relative flex justify-center text-center px-10 mx-6 p-10 overflow-y-auto",
  {
    variants: {
      variant: {
        default: "bg-slate-800 rounded-2xl",
      },
      scale: {
        sm: "max-w-md",
        md: "max-w-lg",
        lg: "max-w-2xl",
        xl: "max-w-4xl",
      },
    },
    defaultVariants: {
      variant: "default",
      scale: "md",
    },
  },
);

interface ModalProps
  extends
    VariantProps<typeof modalVariants>,
    HTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}

function Modal({
  children,
  variant,
  scale,
  className,
  isOpen,
  setIsOpen,
  ...props
}: Readonly<ModalProps>) {
  return (
    <>
      {isOpen && (
        <button
          className="fixed inset-0 w-full h-full bg-black/50 flex justify-center items-center z-1000"
          onClick={() => setIsOpen(false)}
        >
          <button
            className={cn(modalVariants({ variant, scale, className }))}
            onClick={(e) => e.stopPropagation()}
            {...props}
          >
            <X
              color="white"
              className="absolute top-4 right-4 w-8 cursor-pointer transition-transform duration-200 hover:scale-110 hover:brightness-90"
              onClick={() => setIsOpen(false)}
            ></X>
            {children}
          </button>
        </button>
      )}
    </>
  );
}

export default Modal;
