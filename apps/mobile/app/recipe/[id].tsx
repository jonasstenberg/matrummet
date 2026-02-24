import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ActionSheetIOS,
  StyleSheet,
} from 'react-native'
import { useLocalSearchParams, Stack, useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Recipe } from '@matrummet/types/types'
import { api, getImageUrl } from '@/lib/api'
import { IngredientList } from '@/components/ingredient-list'
import { InstructionList } from '@/components/instruction-list'

const isIOS = Platform.OS === 'ios'

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)

  const loadRecipe = useCallback(() => {
    if (!id) return
    api.getRecipe(id)
      .then((r) => {
        setRecipe(r)
        setLiked(r?.is_liked ?? false)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  useFocusEffect(useCallback(() => {
    loadRecipe()
  }, [loadRecipe]))

  const toggleLike = useCallback(async () => {
    if (!id) return
    const newLiked = !liked
    setLiked(newLiked)
    try {
      await api.toggleRecipeLike(id)
    } catch {
      setLiked(!newLiked)
      Alert.alert('Fel', 'Kunde inte uppdatera gilla-markering.')
    }
  }, [id, liked])

  const handleDelete = useCallback(async () => {
    if (!id) return
    try {
      await api.deleteRecipe(id)
      router.back()
    } catch {
      Alert.alert('Fel', 'Kunde inte ta bort receptet.')
    }
  }, [id, router])

  const confirmDelete = useCallback(() => {
    if (isIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Avbryt', 'Ta bort recept'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          title: 'Är du säker?',
          message: 'Receptet tas bort permanent.',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) void handleDelete()
        },
      )
    } else {
      Alert.alert(
        'Ta bort recept',
        'Är du säker? Receptet tas bort permanent.',
        [
          { text: 'Avbryt', style: 'cancel' },
          { text: 'Ta bort', style: 'destructive', onPress: () => void handleDelete() },
        ],
      )
    }
  }, [handleDelete])

  const showActions = useCallback(() => {
    if (!id) return

    if (isIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Avbryt', 'Redigera', 'Ta bort'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) router.push(`/recipe/edit/${id}`)
          if (buttonIndex === 2) confirmDelete()
        },
      )
    } else {
      Alert.alert(
        'Alternativ',
        undefined,
        [
          { text: 'Redigera', onPress: () => router.push(`/recipe/edit/${id}`) },
          { text: 'Ta bort', style: 'destructive', onPress: confirmDelete },
          { text: 'Avbryt', style: 'cancel' },
        ],
      )
    }
  }, [id, router, confirmDelete])

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

  const isOwner = recipe.is_owner ?? false

  const timeText = [
    recipe.prep_time && `${recipe.prep_time} min förb.`,
    recipe.cook_time && `${recipe.cook_time} min tillagn.`,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <Stack.Screen
        options={{
          title: recipe.name,
          headerRight: isOwner ? () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => router.push(`/recipe/edit/${id}`)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.headerButton}
              >
                <Ionicons name="pencil" size={20} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={showActions}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
          ) : undefined,
        }}
      />
      <ScrollView style={styles.scrollView}>
        {(() => {
          const imageUri = getImageUrl(recipe.image, 'large')
          return imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : null
        })()}

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <TouchableOpacity onPress={() => void toggleLike()} style={styles.likeButton}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={26}
                color={liked ? '#ef4444' : '#9ca3af'}
              />
            </TouchableOpacity>
          </View>

          {recipe.description ? (
            <Text style={styles.description}>{recipe.description}</Text>
          ) : null}

          {/* Meta */}
          <View style={styles.metaRow}>
            {timeText ? (
              <View style={styles.metaChip}>
                <Ionicons name="time-outline" size={14} color="#4b5563" style={styles.metaIcon} />
                <Text style={styles.metaChipText}>{timeText}</Text>
              </View>
            ) : null}
            {recipe.recipe_yield ? (
              <View style={styles.metaChip}>
                <Ionicons name="people-outline" size={14} color="#4b5563" style={styles.metaIcon} />
                <Text style={styles.metaChipText}>
                  {recipe.recipe_yield} {recipe.recipe_yield_name ?? 'portioner'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Categories */}
          {recipe.categories.length > 0 && (
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerButton: {
    padding: 2,
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
  description: {
    color: '#4b5563',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  metaIcon: {
    marginRight: 4,
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
