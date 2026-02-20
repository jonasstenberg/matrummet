import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import type { Recipe } from '@matrummet/types/types'
import { api, getImageUrl } from '@/lib/api'
import { IngredientList } from '@/components/ingredient-list'
import { InstructionList } from '@/components/instruction-list'

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    if (!id) return
    api.getRecipe(id)
      .then((r) => {
        setRecipe(r)
        setLiked(r?.is_liked ?? false)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const toggleLike = useCallback(async () => {
    if (!id) return
    const newLiked = !liked
    setLiked(newLiked)
    try {
      await api.toggleRecipeLike(id)
    } catch (_err) {
      setLiked(!newLiked) // Revert
      Alert.alert('Fel', 'Kunde inte uppdatera gilla-markering.')
    }
  }, [id, liked])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    )
  }

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Receptet hittades inte</Text>
      </View>
    )
  }

  const timeText = [
    recipe.prep_time && `${recipe.prep_time} min förb.`,
    recipe.cook_time && `${recipe.cook_time} min tillagn.`,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <Stack.Screen options={{ title: recipe.name }} />
      <ScrollView style={styles.scrollView}>
        {getImageUrl(recipe.image, 'large') && (
          <Image
            source={{ uri: getImageUrl(recipe.image, 'large')! }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <TouchableOpacity onPress={toggleLike} style={styles.likeButton}>
              <Text style={styles.likeIcon}>{liked ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          </View>

          {recipe.description ? (
            <Text style={styles.description}>{recipe.description}</Text>
          ) : null}

          {/* Meta */}
          <View style={styles.metaRow}>
            {timeText ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{timeText}</Text>
              </View>
            ) : null}
            {recipe.recipe_yield ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {recipe.recipe_yield} {recipe.recipe_yield_name ?? 'portioner'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Categories */}
          {recipe.categories?.length > 0 && (
            <View style={styles.categoriesRow}>
              {recipe.categories.map((cat) => (
                <View key={cat} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{cat}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Ingredients */}
          <Text style={styles.sectionTitle}>Ingredienser</Text>
          <IngredientList
            ingredients={recipe.ingredients}
            groups={recipe.ingredient_groups}
          />

          {/* Instructions */}
          <Text style={styles.sectionTitleWithMargin}>Instruktioner</Text>
          <InstructionList
            instructions={recipe.instructions}
            groups={recipe.instruction_groups}
          />
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  notFoundText: {
    color: '#6b7280',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  heroImage: {
    width: '100%',
    height: 256,
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recipeName: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
    color: '#111827',
  },
  likeButton: {
    paddingTop: 4,
  },
  likeIcon: {
    fontSize: 24,
  },
  description: {
    color: '#4b5563',
    fontSize: 14,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metaChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 14,
    color: '#4b5563',
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 24,
  },
  categoryChip: {
    backgroundColor: '#f0fdf4',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryChipText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827',
  },
  sectionTitleWithMargin: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
    color: '#111827',
  },
})
