"use client";

import { CategorySelector } from "@/components/category-selector";
import { ImageUpload } from "@/components/image-upload";
import { IngredientEditor } from "@/components/ingredient-editor";
import { InstructionEditor } from "@/components/instruction-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { recipeInputSchema } from "@/lib/schemas";
import { CreateRecipeInput, Recipe } from "@/lib/types";
import { downloadAndSaveImage } from "@/lib/actions";
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
  lowConfidenceIngredients?: number[];
  onSubmit: (data: CreateRecipeInput) => Promise<void>;
  isSubmitting: boolean;
}

export function RecipeForm({
  initialData,
  lowConfidenceIngredients = [],
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
  const [image, setImage] = useState<string | null>(initialData?.image || null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
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
  const [isProcessing, setIsProcessing] = useState(false);

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function isImageUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    return value.startsWith('http://') || value.startsWith('https://');
  }

  async function uploadFile(file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.filename;
    } catch {
      return null;
    }
  }

  async function downloadAndUploadImageFromUrl(imageUrl: string): Promise<string | null> {
    // Use server action to bypass CORS restrictions
    const result = await downloadAndSaveImage(imageUrl);
    if ('error' in result) {
      console.error('Failed to download image:', result.error);
      return null;
    }
    return result.filename;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError(null);
    setIsProcessing(true);

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

    // Handle image upload - only happens when saving
    let finalImage: string | null = null;
    if (pendingImageFile) {
      // User selected a file - upload it now
      finalImage = await uploadFile(pendingImageFile);
    } else if (isImageUrl(image)) {
      // Image is a URL (from import) - download via server action to bypass CORS
      finalImage = await downloadAndUploadImageFromUrl(image!);
    } else {
      // Image is already a filename or null
      finalImage = image;
    }

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
      image: finalImage,
      thumbnail: finalImage,
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
        setIsProcessing(false);
        return;
      }

      await onSubmit(result.data);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ett oväntat fel uppstod"
      );
      setIsProcessing(false);
    }
  }

  const hasErrors = Object.keys(fieldErrors).length > 0 || submitError;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <Card className="p-6">
        <FieldSet>
          <FieldLegend className="text-xl font-semibold">
            Grundläggande information
          </FieldLegend>

          <FieldGroup>
            <Field data-invalid={!!fieldErrors.recipe_name}>
              <FieldLabel htmlFor="name">Receptnamn *</FieldLabel>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError("recipe_name");
                }}
                placeholder="T.ex. Köttbullar med potatismos"
                aria-invalid={!!fieldErrors.recipe_name}
                aria-describedby={fieldErrors.recipe_name ? "name-error" : undefined}
              />
              <FieldError id="name-error">{fieldErrors.recipe_name}</FieldError>
            </Field>

            <Field data-invalid={!!fieldErrors.description}>
              <FieldLabel htmlFor="description">Beskrivning *</FieldLabel>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  clearFieldError("description");
                }}
                placeholder="En kort beskrivning av receptet"
                className="min-h-[100px]"
                aria-invalid={!!fieldErrors.description}
                aria-describedby={fieldErrors.description ? "description-error" : undefined}
              />
              <FieldError id="description-error">{fieldErrors.description}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="author">Författare</FieldLabel>
              <Input
                id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="T.ex. Mormor Inga"
              />
              <FieldDescription>
                Vem har skapat eller inspirerat detta recept
              </FieldDescription>
            </Field>

            <Field data-invalid={!!fieldErrors.url}>
              <FieldLabel htmlFor="url">Källa (URL)</FieldLabel>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  clearFieldError("url");
                }}
                placeholder="https://..."
                aria-invalid={!!fieldErrors.url}
                aria-describedby={fieldErrors.url ? "url-error" : "url-description"}
              />
              <FieldDescription id="url-description">
                Länk till originalreceptet om det finns
              </FieldDescription>
              <FieldError id="url-error">{fieldErrors.url}</FieldError>
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="recipe-yield">Portioner</FieldLabel>
                <Input
                  id="recipe-yield"
                  type="number"
                  min="1"
                  value={recipeYield}
                  onChange={(e) => setRecipeYield(e.target.value)}
                  placeholder="T.ex. 4"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="recipe-yield-name">Enhet</FieldLabel>
                <Input
                  id="recipe-yield-name"
                  value={recipeYieldName}
                  onChange={(e) => setRecipeYieldName(e.target.value)}
                  placeholder="T.ex. portioner"
                />
                <FieldDescription>
                  T.ex. portioner, bitar, eller liter
                </FieldDescription>
              </Field>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={!!fieldErrors.prep_time}>
                <FieldLabel htmlFor="prep-time">Förberedelse</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="prep-time"
                    type="number"
                    min="0"
                    value={prepTime}
                    onChange={(e) => {
                      setPrepTime(e.target.value);
                      clearFieldError("prep_time");
                    }}
                    placeholder="15"
                    aria-invalid={!!fieldErrors.prep_time}
                    aria-describedby={fieldErrors.prep_time ? "prep-time-error" : undefined}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>min</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError id="prep-time-error">{fieldErrors.prep_time}</FieldError>
              </Field>
              <Field data-invalid={!!fieldErrors.cook_time}>
                <FieldLabel htmlFor="cook-time">Tillagning</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="cook-time"
                    type="number"
                    min="0"
                    value={cookTime}
                    onChange={(e) => {
                      setCookTime(e.target.value);
                      clearFieldError("cook_time");
                    }}
                    placeholder="30"
                    aria-invalid={!!fieldErrors.cook_time}
                    aria-describedby={fieldErrors.cook_time ? "cook-time-error" : undefined}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>min</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError id="cook-time-error">{fieldErrors.cook_time}</FieldError>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="cuisine">Kök/Ursprung</FieldLabel>
              <Input
                id="cuisine"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="T.ex. Svenskt, Italienskt"
              />
              <FieldDescription>
                Vilket matlagningskultur receptet kommer från
              </FieldDescription>
            </Field>

            <ImageUpload
              value={image}
              onChange={setImage}
              pendingFile={pendingImageFile}
              onFileSelect={setPendingImageFile}
            />
          </FieldGroup>
        </FieldSet>
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
        className="p-6"
        data-invalid={!!fieldErrors.ingredients}
      >
        <Field data-invalid={!!fieldErrors.ingredients}>
          <IngredientEditor
            ingredients={ingredients}
            groups={ingredientGroups}
            lowConfidenceIndices={lowConfidenceIngredients}
            onChange={(newIngredients, newGroups) => {
              setIngredients(newIngredients);
              setIngredientGroups(newGroups);
              clearFieldError("ingredients");
            }}
          />
          <FieldError>{fieldErrors.ingredients}</FieldError>
        </Field>
      </Card>

      {/* Instructions */}
      <Card
        className="p-6"
        data-invalid={!!fieldErrors.instructions}
      >
        <Field data-invalid={!!fieldErrors.instructions}>
          <InstructionEditor
            instructions={instructions}
            groups={instructionGroups}
            onChange={(newInstructions, newGroups) => {
              setInstructions(newInstructions);
              setInstructionGroups(newGroups);
              clearFieldError("instructions");
            }}
          />
          <FieldError>{fieldErrors.instructions}</FieldError>
        </Field>
      </Card>

      {/* Submit Section */}
      <div className="md:sticky md:bottom-0 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {hasErrors && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {submitError ||
                "Formuläret innehåller fel. Kontrollera fälten ovan."}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex gap-4">
          <Button type="submit" disabled={isSubmitting || isProcessing} size="lg">
            {isSubmitting || isProcessing
              ? "Sparar..."
              : initialData?.id
              ? "Uppdatera recept"
              : "Spara recept"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.history.back()}
            disabled={isSubmitting || isProcessing}
          >
            Avbryt
          </Button>
        </div>
      </div>
    </form>
  );
}
