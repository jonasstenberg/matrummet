export interface Ingredient {
  name: string;
  measurement: string;
  quantity: string;
  form?: string;
  group_id?: string | null;
}

export interface GroupInfo {
  id: string;
  name: string;
}

export interface IngredientEditorProps {
  ingredients: Ingredient[];
  groups?: GroupInfo[];
  lowConfidenceIndices?: number[];
  onChange: (ingredients: Ingredient[], groups: GroupInfo[]) => void;
}

export type EditorItem =
  | { type: "group"; id: string; name: string }
  | { type: "ingredient"; index: number; data: Ingredient };
