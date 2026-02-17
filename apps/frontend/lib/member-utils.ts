import { getHomeInfo, getCurrentUserId, getUserHomes, getSharedBookUsers } from '@/lib/home-api'

export type MemberEntry = { id: string; name: string; isCurrentUser: boolean; type: 'household' | 'shared-book' }

export async function buildMemberData(
  session: { email: string; name: string }
): Promise<{ memberList: MemberEntry[]; currentUserId: string | null }> {
  const [homes, sharedBooks] = await Promise.all([
    getUserHomes(),
    getSharedBookUsers(),
  ]);

  if (homes.length === 0 && sharedBooks.length === 0) {
    // No homes and no shared books — single-member list with own UUID
    const userId = await getCurrentUserId();
    if (!userId) return { memberList: [], currentUserId: null };
    return {
      memberList: [{ id: userId, name: session.name ?? session.email, isCurrentUser: true, type: 'household' }],
      currentUserId: userId,
    };
  }

  // Deduplicate members across all homes by user id
  const seen = new Map<string, MemberEntry>();

  if (homes.length > 0) {
    // Fetch all home infos in parallel
    const homeInfos = await Promise.all(
      homes.map((h) => getHomeInfo(h.home_id))
    );

    for (const info of homeInfos) {
      if (!info.home) continue;
      for (const m of info.home.members) {
        if (!seen.has(m.id)) {
          seen.set(m.id, {
            id: m.id,
            name: m.name,
            isCurrentUser: m.is_current_user ?? m.email === info.userEmail,
            type: 'household',
          });
        }
      }
    }
  } else {
    // No homes — add self
    const userId = await getCurrentUserId();
    if (userId) {
      seen.set(userId, {
        id: userId,
        name: session.name ?? session.email,
        isCurrentUser: true,
        type: 'household',
      });
    }
  }

  // Add shared book users (skip if already in household)
  for (const book of sharedBooks) {
    if (!seen.has(book.sharer_id)) {
      seen.set(book.sharer_id, {
        id: book.sharer_id,
        name: book.sharer_name,
        isCurrentUser: false,
        type: 'shared-book',
      });
    }
  }

  const memberList = Array.from(seen.values());
  const currentUserId = memberList.find((m) => m.isCurrentUser)?.id ?? null;
  return { memberList, currentUserId };
}

export function resolveSelectedMembers(
  membersParam: string | undefined,
  currentUserId: string | null,
  memberList: MemberEntry[]
): string[] {
  if (membersParam) {
    // Resolve short ID prefixes to full UUIDs
    return membersParam.split(',').filter(Boolean).map((shortId) => {
      const match = memberList.find((m) => m.id.startsWith(shortId));
      return match?.id ?? shortId;
    });
  }
  if (currentUserId) return [currentUserId];
  return [];
}
