import { useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { api } from '@/lib/api'
import { generateRecipeWithAI } from '@/lib/web-api'
import type { AIGenerateResult } from '@/lib/web-api'

const isIOS = Platform.OS === 'ios'

const LOADING_MESSAGES = [
  'Analyserar receptet...',
  'Identifierar ingredienser...',
  'Strukturerar instruktioner...',
  'Snart klart...',
]

function flattenAIResult(recipe: AIGenerateResult['recipe']) {
  const ingredients = (recipe.ingredient_groups ?? []).flatMap(g =>
    g.ingredients.map(i => ({
      name: i.name,
      quantity: i.quantity,
      measurement: i.measurement,
    }))
  )
  const instructions = (recipe.instruction_groups ?? []).flatMap(g =>
    g.instructions.map(i => ({ step: i.step }))
  )
  return { ingredients, instructions }
}

export default function ImportRecipeScreen() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Behörighet saknas', 'Ge appen tillgång till kameran i inställningarna.')
        return
      }
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    }

    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options)

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri)
      }
    } catch {
      Alert.alert('Kamera ej tillgänglig', 'Kameran kan inte användas på denna enhet.')
    }
  }, [])

  const handleImport = useCallback(async () => {
    if (!text.trim() && !imageUri) {
      Alert.alert('Saknas', 'Lägg till en bild eller klistra in text/länk.')
      return
    }

    setLoading(true)
    setLoadingMessageIndex(0)
    const interval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 4000)

    try {
      const result = await generateRecipeWithAI({
        text: text.trim() || undefined,
        imageUri: imageUri ?? undefined,
      })

      const { ingredients, instructions } = flattenAIResult(result.recipe)

      const id = await api.createRecipe({
        recipe_name: result.recipe.recipe_name,
        description: result.recipe.description,
        recipe_yield: result.recipe.recipe_yield ?? null,
        prep_time: result.recipe.prep_time ?? null,
        cook_time: result.recipe.cook_time ?? null,
        categories: result.recipe.categories,
        ingredients,
        instructions,
      })

      router.replace(`/recipe/${id}`)
    } catch (err) {
      Alert.alert('Fel', err instanceof Error ? err.message : 'Importen misslyckades.')
    } finally {
      clearInterval(interval)
      setLoading(false)
    }
  }, [text, imageUri, router])

  return (
    <>
      <Stack.Screen options={{ title: 'Importera recept' }} />
      <KeyboardAvoidingView
        behavior={isIOS ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Foto av recept</Text>
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImageUri(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={28} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imageButtonsRow}>
                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={() => void pickImage('camera')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#f0fdf4', '#e8f5e9']}
                    style={styles.imageButtonGradient}
                  >
                    <Ionicons name="camera" size={32} color="#16a34a" />
                    <Text style={styles.imageButtonText}>Ta foto</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.imageButton}
                  onPress={() => void pickImage('library')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#f0fdf4', '#e8f5e9']}
                    style={styles.imageButtonGradient}
                  >
                    <Ionicons name="images" size={32} color="#16a34a" />
                    <Text style={styles.imageButtonText}>Välj bild</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Text/URL section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Eller klistra in text / länk</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.textInput}
                placeholder="Klistra in recepttext eller en URL..."
                placeholderTextColor="#9ca3af"
                value={text}
                onChangeText={setText}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Info */}
          <View style={styles.infoRow}>
            <Ionicons name="sparkles" size={16} color="#16a34a" />
            <Text style={styles.infoText}>Kostar 1 AI-poäng per import</Text>
          </View>

          {/* Import button */}
          <TouchableOpacity
            style={[styles.importButton, loading && styles.importButtonDisabled]}
            onPress={() => void handleImport()}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.importButtonText}>
                  {LOADING_MESSAGES[loadingMessageIndex]}
                </Text>
              </View>
            ) : (
              <Text style={styles.importButtonText}>Importera med AI</Text>
            )}
          </TouchableOpacity>

          {/* Manual fallback link */}
          <TouchableOpacity
            style={styles.manualLink}
            onPress={() => router.replace('/recipe/manual')}
          >
            <Text style={styles.manualLinkText}>Eller skapa manuellt</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flex: 1,
    backgroundColor: Platform.select({ ios: '#f2f2f7', android: '#f5f5f5' }),
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flex: 1,
    borderRadius: Platform.select({ ios: 12, android: 16 }),
    overflow: 'hidden',
  },
  imageButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  imageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#16a34a',
  },
  imagePreviewContainer: {
    borderRadius: Platform.select({ ios: 12, android: 16 }),
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: Platform.select({ ios: 12, android: 16 }),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
    overflow: 'hidden',
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    minHeight: 120,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
  },
  importButton: {
    backgroundColor: '#16a34a',
    borderRadius: Platform.select({ ios: 12, android: 28 }),
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  importButtonDisabled: {
    opacity: 0.7,
  },
  importButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manualLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  manualLinkText: {
    color: '#6b7280',
    fontSize: 15,
  },
  bottomSpacer: {
    height: 40,
  },
})
