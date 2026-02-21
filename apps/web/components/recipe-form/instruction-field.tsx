
import { useFormContext, useWatch } from "react-hook-form";
import { InstructionEditor } from "@/components/instruction-editor";
import { Field, FieldError } from "@/components/ui/field";
import type { RecipeFormValues } from "@/lib/schemas";

export function InstructionField() {
  const {
    setValue,
    formState: { errors },
  } = useFormContext<RecipeFormValues>();

  const instructions = useWatch<RecipeFormValues, "instructions">({
    name: "instructions",
  });
  const instructionGroups = useWatch<RecipeFormValues, "instructionGroups">({
    name: "instructionGroups",
  });

  const handleChange = (
    newInstructions: typeof instructions,
    newGroups: typeof instructionGroups
  ) => {
    setValue("instructions", newInstructions, { shouldValidate: true });
    setValue("instructionGroups", newGroups);
  };

  return (
    <Field data-invalid={!!errors.instructions}>
      <InstructionEditor
        instructions={instructions}
        groups={instructionGroups}
        onChange={handleChange}
      />
      <FieldError>{errors.instructions?.message}</FieldError>
    </Field>
  );
}
