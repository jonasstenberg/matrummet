"use client";

import { createContext, useContext } from "react";
import type { GroupInfo, Ingredient } from "./types";

export interface IngredientEditorContextValue {
  ingredients: Ingredient[];
  internalGroups: GroupInfo[];
  lowConfidenceIndices: number[];
  addIngredient: (groupId?: string | null) => void;
  updateIngredient: (
    index: number,
    field: keyof Ingredient,
    value: string
  ) => void;
  removeIngredient: (index: number) => void;
  moveIngredient: (index: number, direction: "up" | "down") => void;
  addGroup: () => void;
  removeGroup: (groupId: string) => void;
  moveGroup: (groupId: string, direction: "up" | "down") => void;
  updateGroupName: (groupId: string, name: string) => void;
  isFirstGroup: (groupId: string) => boolean;
  isLastGroup: (groupId: string) => boolean;
}

export const IngredientEditorContext =
  createContext<IngredientEditorContextValue | null>(null);

export function useIngredientEditor(): IngredientEditorContextValue {
  const context = useContext(IngredientEditorContext);
  if (!context) {
    throw new Error(
      "useIngredientEditor must be used within IngredientEditorProvider"
    );
  }
  return context;
}
