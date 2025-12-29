"use client"

import { CategorySelector } from "@/components/category-selector"
import { ImageUpload } from "@/components/image-upload"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { RecipeFormData } from "@/components/create-recipe-wizard"

interface BasicDetailsStepProps {
  formData: RecipeFormData
  onChange: (updates: Partial<RecipeFormData>) => void
}

export function BasicDetailsStep({ formData, onChange }: BasicDetailsStepProps) {
  return (
    <div className="space-y-6">
      <FieldGroup>
        {/* Required fields */}
        <Field>
          <FieldLabel htmlFor="name">
            Receptnamn <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="T.ex. Köttbullar med potatismos"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">
            Beskrivning <span className="text-destructive">*</span>
          </FieldLabel>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="En kort beskrivning av receptet"
            className="min-h-[100px]"
          />
        </Field>

        {/* Yield fields */}
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="recipe-yield">Portioner</FieldLabel>
            <Input
              id="recipe-yield"
              type="number"
              min="1"
              value={formData.recipeYield}
              onChange={(e) => onChange({ recipeYield: e.target.value })}
              placeholder="T.ex. 4"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="recipe-yield-name">Enhet</FieldLabel>
            <Input
              id="recipe-yield-name"
              value={formData.recipeYieldName}
              onChange={(e) => onChange({ recipeYieldName: e.target.value })}
              placeholder="T.ex. portioner"
            />
            <FieldDescription>
              T.ex. portioner, bitar, eller liter
            </FieldDescription>
          </Field>
        </div>

        {/* Time fields */}
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="prep-time">Förberedelse</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="prep-time"
                type="number"
                min="0"
                value={formData.prepTime}
                onChange={(e) => onChange({ prepTime: e.target.value })}
                placeholder="15"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>min</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="cook-time">Tillagning</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="cook-time"
                type="number"
                min="0"
                value={formData.cookTime}
                onChange={(e) => onChange({ cookTime: e.target.value })}
                placeholder="30"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>min</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </div>

        {/* Optional fields */}
        <Field>
          <FieldLabel htmlFor="author">Författare</FieldLabel>
          <Input
            id="author"
            value={formData.author}
            onChange={(e) => onChange({ author: e.target.value })}
            placeholder="T.ex. Mormor Inga"
          />
          <FieldDescription>
            Vem har skapat eller inspirerat detta recept
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="url">Källa (URL)</FieldLabel>
          <Input
            id="url"
            type="url"
            value={formData.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://..."
          />
          <FieldDescription>
            Länk till originalreceptet om det finns
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="cuisine">Kök/Ursprung</FieldLabel>
          <Input
            id="cuisine"
            value={formData.cuisine}
            onChange={(e) => onChange({ cuisine: e.target.value })}
            placeholder="T.ex. Svenskt, Italienskt"
          />
          <FieldDescription>
            Vilken matlagningskultur receptet kommer från
          </FieldDescription>
        </Field>

        {/* Image */}
        <ImageUpload
          value={formData.image}
          onChange={(image) => onChange({ image })}
          pendingFile={formData.pendingImageFile}
          onFileSelect={(file) => onChange({ pendingImageFile: file })}
        />

        {/* Categories */}
        <div className="pt-2">
          <CategorySelector
            selectedCategories={formData.categories}
            onChange={(categories) => onChange({ categories })}
          />
        </div>
      </FieldGroup>
    </div>
  )
}
