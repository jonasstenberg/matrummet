import type { Metadata } from 'next'
import { RecipePageClient } from "@/components/recipe-page-client";
import { LandingPage } from "@/components/landing-page";
import { getRecipesWithCount, getCategories, getFeaturedRecipes } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { getUserPantry } from "@/lib/ingredient-search-actions";
import { getHomeInfo, getCurrentUserId, getUserHomes } from "@/lib/home-api";

export const metadata: Metadata = {
  title: 'Matrummet',
  description: 'Din personliga receptsamling',
}

// ISR: Revalidate every 60 seconds for public (logged-out) content
// Authenticated content bypasses cache via token-based fetches
export const revalidate = 60;

const PAGE_SIZE = 24;

type MemberEntry = { id: string; name: string; isCurrentUser: boolean }

async function buildMemberData(
  session: { email: string; name: string }
): Promise<{ memberList: MemberEntry[]; currentUserId: string | null }> {
  const homes = await getUserHomes();

  if (homes.length === 0) {
    // No homes — single-member list with own UUID
    const userId = await getCurrentUserId();
    if (!userId) return { memberList: [], currentUserId: null };
    return {
      memberList: [{ id: userId, name: session.name ?? session.email, isCurrentUser: true }],
      currentUserId: userId,
    };
  }

  // Fetch all home infos in parallel
  const homeInfos = await Promise.all(
    homes.map((h) => getHomeInfo(h.home_id))
  );

  // Deduplicate members across all homes by user id
  const seen = new Map<string, MemberEntry>();
  for (const info of homeInfos) {
    if (!info.home) continue;
    for (const m of info.home.members) {
      if (!seen.has(m.id)) {
        seen.set(m.id, {
          id: m.id,
          name: m.name,
          isCurrentUser: m.is_current_user ?? m.email === info.userEmail,
        });
      }
    }
  }

  const memberList = Array.from(seen.values());
  const currentUserId = memberList.find((m) => m.isCurrentUser)?.id ?? null;
  return { memberList, currentUserId };
}

function resolveSelectedMembers(membersParam: string | undefined, currentUserId: string | null): string[] {
  if (membersParam) return membersParam.split(',').filter(Boolean);
  if (currentUserId) return [currentUserId];
  return [];
}

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
  const selectedMemberIds = resolveSelectedMembers(membersParam, currentUserId);
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
