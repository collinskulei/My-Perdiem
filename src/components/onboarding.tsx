/**
 * @file This file defines the Onboarding component, which provides a step-by-step tutorial for new users.
 * It uses a dialog with a carousel to guide users through the application's features.
 */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { isTestMode } from "@/lib/test-mode";
import type { OnboardingStep } from "@/lib/onboarding-steps";

interface OnboardingProps {
  steps: OnboardingStep[];
  storageKey: string;
}

/**
 * A component that displays a step-by-step onboarding tutorial in a dialog.
 * @param {OnboardingProps} props - The properties for the component.
 * @returns {JSX.Element | null} The rendered onboarding dialog or null if it should not be shown.
 */
export function Onboarding({ steps, storageKey }: OnboardingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!isTestMode()) return;

    const hasSeenTutorial = localStorage.getItem(storageKey);
    if (!hasSeenTutorial) {
      setIsOpen(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  const handleClose = (skipped = false) => {
    setIsOpen(false);
    // Persist that the user has seen or skipped the tutorial
    localStorage.setItem(storageKey, "true");
  };
  
  if (!isOpen) {
    return null;
  }

  const isLastStep = current === steps.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Welcome to My Perdiem!</DialogTitle>
          <DialogDescription>
            Here’s a quick tour of the features available to you.
          </DialogDescription>
        </DialogHeader>
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent>
            {steps.map((step, index) => (
              <CarouselItem key={index}>
                <div className="p-1">
                  <div className="flex flex-col items-center justify-center gap-6 p-6">
                    <Image
                      src={step.imageUrl}
                      alt={step.title}
                      width={600}
                      height={400}
                      className="rounded-lg border bg-muted"
                      data-ai-hint={step.imageHint}
                    />
                    <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
         <DialogFooter className="flex justify-between w-full">
            <Button variant="ghost" onClick={() => handleClose(true)}>
                Skip Tutorial
            </Button>
            <div className="flex items-center gap-2">
                 <p className="text-sm text-muted-foreground">
                    Step {current + 1} of {steps.length}
                </p>
                {isLastStep && (
                    <Button onClick={() => handleClose()}>Finish</Button>
                )}
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
