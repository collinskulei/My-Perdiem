/**
 * @file This file defines the SuccessDialog component.
 * It's a reusable dialog that displays a prominent success message with an animated checkmark icon,
 * providing clear and positive feedback to the user after completing an action.
 */
"use client";

import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Props for the SuccessDialog component.
 */
interface SuccessDialogProps {
  /** Whether the dialog is currently open. */
  isOpen: boolean;
  /** Callback function to be invoked when the dialog is closed. */
  onClose: () => void;
  /** The main title text of the dialog. */
  title: string;
  /** The descriptive text displayed below the title. */
  description: string;
}

/**
 * A dialog component for displaying a success message.
 * @param {SuccessDialogProps} props - The properties for the component.
 * @returns {JSX.Element} The rendered success dialog.
 */
export function SuccessDialog({ isOpen, onClose, title, description }: SuccessDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full inline-block mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
