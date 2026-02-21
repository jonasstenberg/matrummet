
import { useFormContext, useWatch } from "react-hook-form";
import { IngredientEditor } from "@/components/ingredient-editor";
import { Field, FieldError } from "@/components/ui/field";
import type { RecipeFormValues } from "@/lib/schemas";

interface IngredientFieldProps {
  lowConfidenceIndices?: number[];
}

export function IngredientField({
  lowConfidenceIndices = [],
}: IngredientFieldProps) {
  const {
    setValue,
    formState: { errors },
  } = useFormContext<RecipeFormValues>();

  const ingredients = useWatch<RecipeFormValues, "ingredients">({
    name: "ingredients",
  });
  const ingredientGroups = useWatch<RecipeFormValues, "ingredientGroups">({
    name: "ingredientGroups",
  });

  const handleChange = (
    newIngredients: typeof ingredients,
    newGroups: typeof ingredientGroups
  ) => {
    setValue("ingredients", newIngredients, { shouldValidate: true });
    setValue("ingredientGroups", newGroups);
  };

  return (
    <Field data-invalid={!!errors.ingredients}>
      <IngredientEditor
        ingredients={ingredients}
        groups={ingredientGroups}
        lowConfidenceIndices={lowConfidenceIndices}
        onChange={handleChange}
      />
      <FieldError>{errors.ingredients?.message}</FieldError>
    </Field>
  );
}
