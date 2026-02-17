import type { Metadata } from 'next'
import { RecipePageClient } from "@/components/recipe-page-client";
import { LandingPage } from "@/components/landing-page";
import { getRecipesWithCount, getCategories, getFeaturedRecipes } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { getUserPantry } from "@/lib/ingredient-search-actions";
import { buildMemberData, resolveSelectedMembers } from "@/lib/member-utils";

export const metadata: Metadata = {
  title: 'Matrummet',
  description: 'Din personliga receptsamling',
}

// ISR: Revalidate every 60 seconds for public (logged-out) content
// Authenticated content bypasses cache via token-based fetches
export const revalidate = 60;

const PAGE_SIZE = 24;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; members?: string }>
}) {
  const session = await getSession();

  // Show landing page for non-authenticated users
  if (!session) {
    const featuredRecipes = await getFeaturedRecipes(4);
    return <LandingPage recipes={featuredRecipes} />;
  }

  const token = await signPostgrestToken(session.email);
  const { offset: offsetParam, members: membersParam } = await searchParams;
  const initialLimit = offsetParam ? Math.max(PAGE_SIZE, parseInt(offsetParam, 10)) : PAGE_SIZE;

  // Fetch member data and other data in parallel
  const [memberData, categories, pantryResult] = await Promise.all([
    buildMemberData(session),
    getCategories(),
    getUserPantry(),
  ]);

  const { memberList, currentUserId } = memberData;
  const selectedMemberIds = resolveSelectedMembers(membersParam, currentUserId, memberList);
  const ownerIds = selectedMemberIds.length > 0 ? selectedMemberIds : undefined;

  const recipeResult = await getRecipesWithCount({ ownerIds, token, limit: initialLimit });

  // Handle pantry error case
  const pantryItems = Array.isArray(pantryResult) ? pantryResult : [];

  return (
    <RecipePageClient
      initialRecipes={recipeResult.recipes}
      initialPantry={pantryItems}
      groupedCategories={categories}
      members={memberList}
      selectedMemberIds={selectedMemberIds}
      isAuthenticated={true}
      totalCount={recipeResult.totalCount}
      pageSize={PAGE_SIZE}
    />
  );
}
