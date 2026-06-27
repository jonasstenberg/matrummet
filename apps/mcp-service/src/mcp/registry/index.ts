import type { ToolDef } from "../tool.js";
import { apiKeyTools } from "./api-keys.js";
import { bookSharingTools } from "./book-sharing.js";
import { browseTools } from "./browse.js";
import { collectionTools } from "./collections.js";
import { creditTools } from "./credits.js";
import { householdTools } from "./household.js";
import { imageTools } from "./image.js";
import { mealPlanTools } from "./meal-plans.js";
import { pantryTools } from "./pantry.js";
import { recipeTools } from "./recipes.js";
import { searchTools } from "./search.js";
import { sharingTools } from "./sharing.js";
import { shoppingListTools } from "./shopping-lists.js";

export const allTools: ToolDef[] = [
  ...recipeTools,
  ...browseTools,
  ...searchTools,
  ...sharingTools,
  ...bookSharingTools,
  ...collectionTools,
  ...pantryTools,
  ...shoppingListTools,
  ...mealPlanTools,
  ...householdTools,
  ...creditTools,
  ...apiKeyTools,
  ...imageTools,
];

// Guard against accidental duplicate tool names at startup.
const seen = new Set<string>();
for (const tool of allTools) {
  if (seen.has(tool.name)) {
    throw new Error(`Duplicate MCP tool name: ${tool.name}`);
  }
  seen.add(tool.name);
}
