import { redirect } from 'next/navigation'

// Redirect /alla-recept to / (all recipes are now on the home page)
export default function AllRecipesPage() {
  redirect('/')
}
