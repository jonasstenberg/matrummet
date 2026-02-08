import { AuthProvider } from "@/components/auth-provider";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SearchRow } from "@/components/search-row";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { User } from "@/lib/types";

async function getUserData(): Promise<User | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  try {
    // Create PostgREST-compatible JWT with the user's email
    const postgrestToken = await signPostgrestToken(session.email);

    // Fetch full user data and home info in parallel
    const [userResponse, homeResponse] = await Promise.all([
      fetch(
        `${env.POSTGREST_URL}/users?email=eq.${encodeURIComponent(
          session.email
        )}&select=id,name,email,measures_system,provider,owner,role`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${postgrestToken}`,
          },
        }
      ),
      fetch(`${env.POSTGREST_URL}/rpc/get_home_info`, {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${postgrestToken}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    ]);

    if (!userResponse.ok) {
      return null;
    }

    const users = await userResponse.json();
    const user = users[0];

    if (!user) {
      return null;
    }

    // Parse home info if available
    let homeId: string | undefined;
    let homeName: string | undefined;

    if (homeResponse.ok) {
      const homeInfo = await homeResponse.json();
      if (homeInfo) {
        homeId = homeInfo.id;
        homeName = homeInfo.name;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      measures_system: user.measures_system,
      provider: user.provider,
      owner: user.owner,
      role: user.role,
      home_id: homeId,
      home_name: homeName,
    };
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    return null;
  }
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserData();

  return (
    <AuthProvider initialUser={user}>
      <Header />
      {user && <SearchRow />}
      <main className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 py-8">{children}</div>
      </main>
      <Footer />
    </AuthProvider>
  );
}
