import { useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import type { Recipe } from '@matrummet/types/types'
import { getImageUrl } from '@/lib/api'

interface RecipeCardProps {
  recipe: Recipe
  onPress: () => void
}

function PlaceholderImage() {
  return (
    <LinearGradient
      colors={['#f3f4f6', '#e8e8ec', '#dcdce2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.image}
    >
      <View style={styles.placeholderIconContainer}>
        <Ionicons name="restaurant-outline" size={32} color="rgba(22, 163, 74, 0.4)" />
      </View>
    </LinearGradient>
  )
}

export function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  const timeText = [
    recipe.prep_time && `${recipe.prep_time} min`,
    recipe.cook_time && `${recipe.cook_time} min`,
  ].filter(Boolean).join(' + ')

  const imageUrl = getImageUrl(recipe.image, 'medium')
  const [imageError, setImageError] = useState(false)
  const showImage = imageUrl && !imageError

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {showImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <PlaceholderImage />
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {recipe.name}
        </Text>
        {recipe.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {recipe.description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {timeText ? (
            <Text style={styles.metaText}>{timeText}</Text>
          ) : null}
          {recipe.categories.length > 0 && (
            <Text style={styles.metaText} numberOfLines={1}>
              {recipe.categories.slice(0, 3).join(' · ')}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  image: {
    width: '100%',
    height: 160,
  },
  placeholderIconContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#111827',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
})
