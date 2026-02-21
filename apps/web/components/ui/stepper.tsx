
import * as React from "react"
import { Check } from "@/lib/icons"
import { cn } from "@/lib/utils"

interface Step {
  id: string
  title: string
  description?: string
}

interface StepperContextValue {
  currentStep: number
  steps: Step[]
  goToStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  isFirstStep: boolean
  isLastStep: boolean
}

const StepperContext = React.createContext<StepperContextValue | null>(null)

function useStepper() {
  const context = React.useContext(StepperContext)
  if (!context) {
    throw new Error("useStepper must be used within a Stepper")
  }
  return context
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  onStepChange: (step: number) => void
  children: React.ReactNode
  className?: string
}

function Stepper({
  steps,
  currentStep,
  onStepChange,
  children,
  className,
}: StepperProps) {
  const goToStep = React.useCallback(
    (step: number) => {
      if (step >= 0 && step < steps.length) {
        onStepChange(step)
      }
    },
    [steps.length, onStepChange]
  )

  const nextStep = React.useCallback(() => {
    goToStep(currentStep + 1)
  }, [currentStep, goToStep])

  const prevStep = React.useCallback(() => {
    goToStep(currentStep - 1)
  }, [currentStep, goToStep])

  const value = React.useMemo(
    () => ({
      currentStep,
      steps,
      goToStep,
      nextStep,
      prevStep,
      isFirstStep: currentStep === 0,
      isLastStep: currentStep === steps.length - 1,
    }),
    [currentStep, steps, goToStep, nextStep, prevStep]
  )

  return (
    <StepperContext.Provider value={value}>
      <div className={cn("flex flex-col gap-6", className)}>{children}</div>
    </StepperContext.Provider>
  )
}

function StepperHeader({ className }: { className?: string }) {
  const { steps, currentStep, goToStep } = useStepper()

  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isClickable = index <= currentStep
          const isLast = index === steps.length - 1

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center",
                !isLast && "flex-1"
              )}
            >
              <button
                type="button"
                onClick={() => isClickable && goToStep(index)}
                disabled={!isClickable}
                className={cn(
                  "group flex flex-col items-center gap-2 shrink-0",
                  isClickable ? "cursor-pointer" : "cursor-default"
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {/* Step indicator */}
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      "border-primary bg-primary/10 text-primary",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Step label */}
                <div className="text-center">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCurrent && "text-foreground",
                      isCompleted && "text-foreground",
                      !isCompleted && !isCurrent && "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground hidden sm:block">
                      {step.description}
                    </p>
                  )}
                </div>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "mx-4 h-0.5 flex-1 min-w-8 transition-colors",
                    index < currentStep ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function StepperContent({
  step,
  children,
  className,
}: {
  step: number
  children: React.ReactNode
  className?: string
}) {
  const { currentStep } = useStepper()

  if (currentStep !== step) {
    return null
  }

  return <div className={className}>{children}</div>
}

function StepperFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t bg-muted/30 px-6 py-4 mt-8 -mx-6 -mb-6 rounded-b-lg",
        className
      )}
    >
      {children}
    </div>
  )
}

export {
  Stepper,
  StepperHeader,
  StepperContent,
  StepperFooter,
  useStepper,
  type Step,
}
