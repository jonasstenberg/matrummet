"use client";

import { CategorySelector } from "@/components/category-selector";
import { ImageUpload } from "@/components/image-upload";
import { IngredientEditor } from "@/components/ingredient-editor";
import { InstructionEditor } from "@/components/instruction-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recipeInputSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { CreateRecipeInput, Recipe } from "@/lib/types";
import { useState } from "react";

type FieldErrors = Record<string, string>;

// Transform ingredients to inline group markers format
function transformIngredientsToInlineFormat(
  ingredients: Array<{
    name: string;
    measurement: string;
    quantity: string;
    group_id?: string | null;
  }>,
  groups: Array<{ id: string; name: string }>
): Array<
  { group: string } | { name: string; measurement: string; quantity: string }
> {
  const result: Array<
    { group: string } | { name: string; measurement: string; quantity: string }
  > = [];
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));
  let lastGroupId: string | null = null;

  ingredients.forEach((ingredient) => {
    const currentGroupId = ingredient.group_id || null;

    // If we encounter a new group, add a group marker
    if (currentGroupId && currentGroupId !== lastGroupId) {
      const groupName = groupMap.get(currentGroupId) || "Grupp";
      result.push({ group: groupName });
      lastGroupId = currentGroupId;
    } else if (!currentGroupId && lastGroupId !== null) {
      // Transitioning from grouped to ungrouped
      lastGroupId = null;
    }

    // Add the ingredient (only if it has a name)
    if (ingredient.name.trim()) {
      result.push({
        name: ingredient.name,
        measurement: ingredient.measurement,
        quantity: ingredient.quantity,
      });
    }
  });

  return result;
}

// Transform instructions to inline group markers format
function transformInstructionsToInlineFormat(
  instructions: Array<{ step: string; group_id?: string | null }>,
  groups: Array<{ id: string; name: string }>
): Array<{ group: string } | { step: string }> {
  const result: Array<{ group: string } | { step: string }> = [];
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));
  let lastGroupId: string | null = null;

  instructions.forEach((instruction) => {
    const currentGroupId = instruction.group_id || null;

    // If we encounter a new group, add a group marker
    if (currentGroupId && currentGroupId !== lastGroupId) {
      const groupName = groupMap.get(currentGroupId) || "Grupp";
      result.push({ group: groupName });
      lastGroupId = currentGroupId;
    } else if (!currentGroupId && lastGroupId !== null) {
      // Transitioning from grouped to ungrouped
      lastGroupId = null;
    }

    // Add the instruction (only if it has a step)
    if (instruction.step.trim()) {
      result.push({ step: instruction.step });
    }
  });

  return result;
}

interface RecipeFormProps {
  initialData?: Recipe;
  onSubmit: (data: CreateRecipeInput) => Promise<void>;
  isSubmitting: boolean;
}

export function RecipeForm({
  initialData,
  onSubmit,
  isSubmitting,
}: RecipeFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [author, setAuthor] = useState(initialData?.author || "");
  const [url, setUrl] = useState(initialData?.url || "");
  const [recipeYield, setRecipeYield] = useState(
    initialData?.recipe_yield?.toString() || ""
  );
  const [recipeYieldName, setRecipeYieldName] = useState(
    initialData?.recipe_yield_name || ""
  );
  const [prepTime, setPrepTime] = useState(
    initialData?.prep_time?.toString() || ""
  );
  const [cookTime, setCookTime] = useState(
    initialData?.cook_time?.toString() || ""
  );
  const [cuisine, setCuisine] = useState(initialData?.cuisine || "");
  const [image, setImage] = useState(initialData?.image || null);
  const [categories, setCategories] = useState<string[]>(
    initialData?.categories || []
  );
  const [ingredients, setIngredients] = useState(
    initialData?.ingredients || [{ name: "", measurement: "", quantity: "" }]
  );
  const [ingredientGroups, setIngredientGroups] = useState<
    Array<{ id: string; name: string }>
  >(
    initialData?.ingredient_groups?.map((g) => ({ id: g.id!, name: g.name })) ||
      []
  );
  const [instructions, setInstructions] = useState(
    initialData?.instructions || [{ step: "" }]
  );
  const [instructionGroups, setInstructionGroups] = useState<
    Array<{ id: string; name: string }>
  >(
    initialData?.instruction_groups?.map((g) => ({
      id: g.id!,
      name: g.name,
    })) || []
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError(null);

    // Filter out empty ingredients and instructions
    const validIngredients = ingredients.filter((i) => i.name.trim());
    const validInstructions = instructions.filter((i) => i.step.trim());

    // Transform ingredients to inline group markers format
    const transformedIngredients = transformIngredientsToInlineFormat(
      validIngredients,
      ingredientGroups
    );

    // Transform instructions to inline group markers format
    const transformedInstructions = transformInstructionsToInlineFormat(
      validInstructions,
      instructionGroups
    );

    const data: CreateRecipeInput = {
      recipe_name: name.trim(),
      author: author.trim() || null,
      description: description.trim(),
      url: url.trim() || null,
      recipe_yield: recipeYield || null,
      recipe_yield_name: recipeYieldName.trim() || null,
      prep_time: prepTime.trim() ? parseInt(prepTime.trim(), 10) : null,
      cook_time: cookTime.trim() ? parseInt(cookTime.trim(), 10) : null,
      cuisine: cuisine.trim() || null,
      image,
      thumbnail: image,
      categories,
      ingredients: transformedIngredients,
      instructions: transformedInstructions,
    };

    try {
      // Validate with Zod
      const result = recipeInputSchema.safeParse(data);

      if (!result.success) {
        // Map Zod errors to field names
        const errors: FieldErrors = {};
        for (const issue of result.error.issues) {
          const path = issue.path[0]?.toString() || "form";
          if (!errors[path]) {
            errors[path] = issue.message;
          }
        }
        setFieldErrors(errors);
        return;
      }

      await onSubmit(result.data);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ett oväntat fel uppstod"
      );
    }
  }

  const hasErrors = Object.keys(fieldErrors).length > 0 || submitError;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-semibold">
          Grundläggande information
        </h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Receptnamn *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearFieldError("recipe_name");
              }}
              placeholder="T.ex. Köttbullar med potatismos"
              className={cn(fieldErrors.recipe_name && "border-destructive")}
            />
            {fieldErrors.recipe_name && (
              <p className="mt-1 text-sm text-destructive">
                {fieldErrors.recipe_name}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Beskrivning *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearFieldError("description");
              }}
              placeholder="En kort beskrivning av receptet"
              className={cn(
                "min-h-[100px]",
                fieldErrors.description && "border-destructive"
              )}
            />
            {fieldErrors.description && (
              <p className="mt-1 text-sm text-destructive">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="author">Författare</Label>
            <Input
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="T.ex. Mormor Inga"
            />
          </div>

          <div>
            <Label htmlFor="url">Källa (URL)</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                clearFieldError("url");
              }}
              placeholder="https://..."
              className={cn(fieldErrors.url && "border-destructive")}
            />
            {fieldErrors.url && (
              <p className="mt-1 text-sm text-destructive">{fieldErrors.url}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="recipe-yield">Portioner</Label>
              <Input
                id="recipe-yield"
                value={recipeYield}
                onChange={(e) => setRecipeYield(e.target.value)}
                placeholder="T.ex. 4"
              />
            </div>
            <div>
              <Label htmlFor="recipe-yield-name">Enhet</Label>
              <Input
                id="recipe-yield-name"
                value={recipeYieldName}
                onChange={(e) => setRecipeYieldName(e.target.value)}
                placeholder="T.ex. portioner"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="prep-time">Förberedelse (min)</Label>
              <Input
                id="prep-time"
                type="number"
                min="0"
                value={prepTime}
                onChange={(e) => {
                  setPrepTime(e.target.value);
                  clearFieldError("prep_time");
                }}
                placeholder="T.ex. 15"
                className={cn(fieldErrors.prep_time && "border-destructive")}
              />
              {fieldErrors.prep_time && (
                <p className="mt-1 text-sm text-destructive">
                  {fieldErrors.prep_time}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="cook-time">Tillagning (min)</Label>
              <Input
                id="cook-time"
                type="number"
                min="0"
                value={cookTime}
                onChange={(e) => {
                  setCookTime(e.target.value);
                  clearFieldError("cook_time");
                }}
                placeholder="T.ex. 30"
                className={cn(fieldErrors.cook_time && "border-destructive")}
              />
              {fieldErrors.cook_time && (
                <p className="mt-1 text-sm text-destructive">
                  {fieldErrors.cook_time}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="cuisine">Kök/Ursprung</Label>
            <Input
              id="cuisine"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="T.ex. Svenskt, Italienskt"
            />
          </div>

          <ImageUpload value={image} onChange={setImage} />
        </div>
      </Card>

      {/* Categories */}
      <Card className="p-6">
        <CategorySelector
          selectedCategories={categories}
          onChange={setCategories}
        />
      </Card>

      {/* Ingredients */}
      <Card
        className={cn("p-6", fieldErrors.ingredients && "border-destructive")}
      >
        <IngredientEditor
          ingredients={ingredients}
          groups={ingredientGroups}
          onChange={(newIngredients, newGroups) => {
            setIngredients(newIngredients);
            setIngredientGroups(newGroups);
            clearFieldError("ingredients");
          }}
        />
        {fieldErrors.ingredients && (
          <p className="mt-2 text-sm text-destructive">
            {fieldErrors.ingredients}
          </p>
        )}
      </Card>

      {/* Instructions */}
      <Card
        className={cn("p-6", fieldErrors.instructions && "border-destructive")}
      >
        <InstructionEditor
          instructions={instructions}
          groups={instructionGroups}
          onChange={(newInstructions, newGroups) => {
            setInstructions(newInstructions);
            setInstructionGroups(newGroups);
            clearFieldError("instructions");
          }}
        />
        {fieldErrors.instructions && (
          <p className="mt-2 text-sm text-destructive">
            {fieldErrors.instructions}
          </p>
        )}
      </Card>

      {/* Submit Section */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {hasErrors && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {submitError ||
                "Formuläret innehåller fel. Kontrollera fälten ovan."}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting
              ? "Sparar..."
              : initialData
              ? "Uppdatera recept"
              : "Skapa recept"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.history.back()}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
        </div>
      </div>
    </form>
  );
}
