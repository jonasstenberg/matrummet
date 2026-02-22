
import { CategorySelector } from "@/components/category-selector";
import { ImageUpload } from "@/components/image-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldSet,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { recipeInputSchema, recipeFormSchema, RecipeFormValues } from "@/lib/schemas";
import { CreateRecipeInput, Recipe } from "@/lib/types";
import {
  RecipeFormData,
  transformIngredientsToInlineFormat,
  transformInstructionsToInlineFormat,
  computeDefaultValues,
} from "@/lib/recipe-form-utils";
import { isRecipe, isRecipeFormData } from "@/lib/type-guards";
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useImageUpload } from "@/lib/hooks/use-image-upload";
import { useAiRefinement } from "@/lib/hooks/use-ai-refinement";
import { IngredientField } from "./recipe-form/ingredient-field";
import { InstructionField } from "./recipe-form/instruction-field";
import {
  Sparkles,
  BookOpen,
  Tag,
  ShoppingCart,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "@/lib/icons";

function CollapsibleSection({
  title,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  children,
  defaultOpen = true,
  dataInvalid,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  iconBg?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  dataInvalid?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-2xl bg-card shadow-(--shadow-card)"
      data-invalid={dataInvalid || undefined}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                iconBg
              )}
            >
              <Icon className={cn("h-4 w-4", iconColor)} />
            </div>
          )}
          <span className="text-[15px] font-medium text-foreground">
            {title}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            !isOpen && "-rotate-90"
          )}
        />
      </button>
      {isOpen && (
        <div className="border-t border-border/40 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

interface RecipeFormProps {
  initialData?: Recipe | RecipeFormData;
  lowConfidenceIngredients?: number[];
  onSubmit: (data: CreateRecipeInput) => Promise<void>;
  isSubmitting: boolean;
  aiGenerated?: boolean;
}

export function RecipeForm({
  initialData,
  lowConfidenceIngredients = [],
  onSubmit,
  isSubmitting,
  aiGenerated = false,
}: RecipeFormProps) {
  const router = useRouter();

  // Setup react-hook-form
  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: computeDefaultValues(initialData),
    mode: "onBlur",
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  // Image upload hook
  const imageUpload = useImageUpload({
    initialFile: isRecipeFormData(initialData) ? initialData.pendingImageFile : null,
  });

  // AI refinement hook
  const originalPrompt = isRecipeFormData(initialData) ? initialData.originalPrompt : null;
  const aiRefinement = useAiRefinement({
    originalPrompt,
    aiGenerated,
    form,
  });

  // Submission state
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  async function onFormSubmit(formValues: RecipeFormValues) {
    setSubmitError(null);
    setIsProcessing(true);

    // Filter out empty ingredients and instructions
    const validIngredients = formValues.ingredients.filter((i) => i.name.trim());
    const validInstructions = formValues.instructions.filter((i) => i.step.trim());

    // Transform ingredients to inline group markers format
    const transformedIngredients = transformIngredientsToInlineFormat(
      validIngredients,
      formValues.ingredientGroups
    );

    // Transform instructions to inline group markers format
    const transformedInstructions = transformInstructionsToInlineFormat(
      validInstructions,
      formValues.instructionGroups
    );

    // Handle image upload - only happens when saving
    let finalImage: string | null = null;
    if (imageUpload.pendingFile) {
      finalImage = await imageUpload.uploadFile(imageUpload.pendingFile);
    } else if (imageUpload.isImageUrl(formValues.image)) {
      finalImage = await imageUpload.downloadAndUploadImageFromUrl(formValues.image!);
    } else {
      finalImage = formValues.image;
    }

    const data: CreateRecipeInput = {
      recipe_name: formValues.name.trim(),
      author: formValues.author.trim() || null,
      description: formValues.description.trim(),
      url: formValues.url.trim() || null,
      recipe_yield: formValues.recipeYield || null,
      recipe_yield_name: formValues.recipeYieldName.trim() || null,
      prep_time: formValues.prepTime.trim() ? parseInt(formValues.prepTime.trim(), 10) : null,
      cook_time: formValues.cookTime.trim() ? parseInt(formValues.cookTime.trim(), 10) : null,
      cuisine: formValues.cuisine.trim() || null,
      image: finalImage,
      categories: formValues.categories,
      ingredients: transformedIngredients,
      instructions: transformedInstructions,
    };

    try {
      const result = recipeInputSchema.safeParse(data);

      if (!result.success) {
        // Map Zod errors to form errors
        for (const issue of result.error.issues) {
          const path = issue.path[0]?.toString();
          if (path) {
            // Map API field names to form field names
            const fieldMap: Record<string, keyof RecipeFormValues> = {
              recipe_name: "name",
              prep_time: "prepTime",
              cook_time: "cookTime",
            };
            const formField = fieldMap[path] || path;
            form.setError(formField as keyof RecipeFormValues, {
              type: "manual",
              message: issue.message,
            });
          }
        }
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

  const hasErrors = Object.keys(errors).length > 0 || submitError;

  return (
    <FormProvider {...form}>
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {/* AI Refinement Section */}
      {aiRefinement.showAiRefinement && (
        <div className="rounded-2xl bg-card shadow-(--shadow-card) overflow-hidden">
          <div className="bg-warm/5 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warm/15">
                  <Sparkles className="h-4 w-4 text-warm" />
                </div>
                <span className="text-[15px] font-medium">AI-genererat recept</span>
              </div>
              {originalPrompt && (
                <button
                  type="button"
                  onClick={() => aiRefinement.setIsPromptExpanded(!aiRefinement.isPromptExpanded)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {aiRefinement.isPromptExpanded ? (
                    <>
                      Dölj prompt <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Visa prompt <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-border/40 px-5 py-4 space-y-3">
            {aiRefinement.isPromptExpanded && originalPrompt && (
              <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">
                {originalPrompt}
              </div>
            )}

            <Textarea
              placeholder="Beskriv hur du vill förfina receptet, t.ex. 'Lägg till mer vitlök' eller 'Gör det veganskt'..."
              value={aiRefinement.refinementText}
              onChange={(e) => {
                aiRefinement.setRefinementText(e.target.value);
                aiRefinement.clearError();
              }}
              className="min-h-[60px] text-sm"
              disabled={aiRefinement.isRefining}
            />
            {aiRefinement.refineError && (
              <Alert variant="destructive">
                <AlertDescription>{aiRefinement.refineError}</AlertDescription>
              </Alert>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={aiRefinement.handleRefine}
              disabled={!aiRefinement.refinementText.trim() || aiRefinement.isRefining}
              className="w-full"
            >
              {aiRefinement.isRefining ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Förfinar...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-3 w-3" />
                  Förfina med AI
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <CollapsibleSection
        title="Grundläggande"
        icon={BookOpen}
        iconColor="text-primary"
        iconBg="bg-primary/10"
      >
        <FieldSet>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Receptnamn *</FieldLabel>
              <Input
                id="name"
                {...register("name")}
                placeholder="T.ex. Köttbullar med potatismos"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              <FieldError id="name-error">{errors.name?.message}</FieldError>
            </Field>

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="description">Beskrivning *</FieldLabel>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="En kort beskrivning av receptet"
                className="min-h-[100px]"
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "description-error" : undefined}
              />
              <FieldError id="description-error">
                {errors.description?.message}
              </FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="author">Författare</FieldLabel>
              <Input
                id="author"
                {...register("author")}
                placeholder="T.ex. Mormor Inga"
              />
              <FieldDescription>
                Vem har skapat eller inspirerat detta recept
              </FieldDescription>
            </Field>

            <Field data-invalid={!!errors.url}>
              <FieldLabel htmlFor="url">Källa (URL)</FieldLabel>
              <Input
                id="url"
                type="url"
                {...register("url")}
                placeholder="https://..."
                aria-invalid={!!errors.url}
                aria-describedby={errors.url ? "url-error" : "url-description"}
              />
              <FieldDescription id="url-description">
                Länk till originalreceptet om det finns
              </FieldDescription>
              <FieldError id="url-error">{errors.url?.message}</FieldError>
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="recipe-yield">Portioner</FieldLabel>
                <Input
                  id="recipe-yield"
                  type="number"
                  min="1"
                  {...register("recipeYield")}
                  placeholder="T.ex. 4"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="recipe-yield-name">Enhet</FieldLabel>
                <Input
                  id="recipe-yield-name"
                  {...register("recipeYieldName")}
                  placeholder="T.ex. portioner"
                />
                <FieldDescription>
                  T.ex. portioner, bitar, eller liter
                </FieldDescription>
              </Field>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={!!errors.prepTime}>
                <FieldLabel htmlFor="prep-time">Förberedelse</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="prep-time"
                    type="number"
                    min="0"
                    {...register("prepTime")}
                    placeholder="15"
                    aria-invalid={!!errors.prepTime}
                    aria-describedby={errors.prepTime ? "prep-time-error" : undefined}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>min</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError id="prep-time-error">
                  {errors.prepTime?.message}
                </FieldError>
              </Field>
              <Field data-invalid={!!errors.cookTime}>
                <FieldLabel htmlFor="cook-time">Tillagning</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="cook-time"
                    type="number"
                    min="0"
                    {...register("cookTime")}
                    placeholder="30"
                    aria-invalid={!!errors.cookTime}
                    aria-describedby={errors.cookTime ? "cook-time-error" : undefined}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>min</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError id="cook-time-error">
                  {errors.cookTime?.message}
                </FieldError>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="cuisine">Kök/Ursprung</FieldLabel>
              <Input
                id="cuisine"
                {...register("cuisine")}
                placeholder="T.ex. Svenskt, Italienskt"
              />
              <FieldDescription>
                Vilket matlagningskultur receptet kommer från
              </FieldDescription>
            </Field>

            <Controller
              name="image"
              control={control}
              render={({ field }) => (
                <ImageUpload
                  value={field.value}
                  onChange={field.onChange}
                  pendingFile={imageUpload.pendingFile}
                  pendingFilePreview={imageUpload.filePreview}
                  onFileSelect={imageUpload.selectFile}
                />
              )}
            />
          </FieldGroup>
        </FieldSet>
      </CollapsibleSection>

      {/* Categories */}
      <CollapsibleSection
        title="Kategorier"
        icon={Tag}
        iconColor="text-amber-600 dark:text-amber-400"
        iconBg="bg-amber-500/10"
      >
        <Controller
          name="categories"
          control={control}
          render={({ field }) => (
            <CategorySelector
              selectedCategories={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </CollapsibleSection>

      {/* Ingredients */}
      <CollapsibleSection
        title="Ingredienser"
        icon={ShoppingCart}
        iconColor="text-green-600 dark:text-green-400"
        iconBg="bg-green-500/10"
        dataInvalid={!!errors.ingredients}
      >
        <IngredientField lowConfidenceIndices={lowConfidenceIngredients} />
      </CollapsibleSection>

      {/* Instructions */}
      <CollapsibleSection
        title="Instruktioner"
        icon={ListOrdered}
        iconColor="text-violet-600 dark:text-violet-400"
        iconBg="bg-violet-500/10"
        dataInvalid={!!errors.instructions}
      >
        <InstructionField />
      </CollapsibleSection>

      {/* Submit Section */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card) md:sticky md:bottom-0 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="px-5 py-4">
          {hasErrors && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {submitError ||
                  "Formuläret innehåller fel. Kontrollera fälten ovan."}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isSubmitting || isProcessing}
              size="lg"
            >
              {isSubmitting || isProcessing
                ? "Sparar..."
                : isRecipe(initialData)
                ? "Uppdatera recept"
                : "Spara recept"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => router.history.back()}
              disabled={isSubmitting || isProcessing}
            >
              Avbryt
            </Button>
          </div>
        </div>
      </div>
    </form>
    </FormProvider>
  );
}
