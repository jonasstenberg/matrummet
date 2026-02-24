import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native'
import { Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { CategoryGroup, Recipe } from '@matrummet/types/types'
import { api } from '@/lib/api'
import { CategoryPicker } from '@/components/category-picker'

interface IngredientRow {
  name: string
  quantity: string
  measurement: string
}

interface InstructionRow {
  step: string
}

interface RecipeFormProps {
  title: string
  recipe?: Recipe
  onSave: (data: RecipeFormData) => Promise<void>
}

export interface RecipeFormData {
  name: string
  description: string
  servings: string
  prepTime: string
  cookTime: string
  categories: string[]
  ingredients: IngredientRow[]
  instructions: InstructionRow[]
}

const isIOS = Platform.OS === 'ios'

function ingredientsFromRecipe(recipe: Recipe): IngredientRow[] {
  if (recipe.ingredients.length === 0) return [{ name: '', quantity: '', measurement: '' }]
  return recipe.ingredients.map(i => ({
    name: i.name,
    quantity: i.quantity,
    measurement: i.measurement,
  }))
}

function instructionsFromRecipe(recipe: Recipe): InstructionRow[] {
  if (recipe.instructions.length === 0) return [{ step: '' }]
  return recipe.instructions.map(i => ({ step: i.step }))
}

export function RecipeForm({ title, recipe, onSave }: RecipeFormProps) {
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(recipe?.name ?? '')
  const [description, setDescription] = useState(recipe?.description ?? '')
  const [servings, setServings] = useState(recipe?.recipe_yield?.toString() ?? '')
  const [prepTime, setPrepTime] = useState(recipe?.prep_time?.toString() ?? '')
  const [cookTime, setCookTime] = useState(recipe?.cook_time?.toString() ?? '')

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(recipe?.categories ?? [])
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    recipe ? ingredientsFromRecipe(recipe) : [{ name: '', quantity: '', measurement: '' }],
  )

  const [instructions, setInstructions] = useState<InstructionRow[]>(
    recipe ? instructionsFromRecipe(recipe) : [{ step: '' }],
  )

  useEffect(() => {
    void api.getCategories().then(setCategoryGroups)
  }, [])

  const updateIngredient = useCallback((index: number, field: keyof IngredientRow, value: string) => {
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, [field]: value } : ing))
  }, [])

  const addIngredient = useCallback(() => {
    setIngredients(prev => [...prev, { name: '', quantity: '', measurement: '' }])
  }, [])

  const removeIngredient = useCallback((index: number) => {
    setIngredients(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)
  }, [])

  const updateInstruction = useCallback((index: number, value: string) => {
    setInstructions(prev => prev.map((inst, i) => i === index ? { step: value } : inst))
  }, [])

  const addInstruction = useCallback(() => {
    setInstructions(prev => [...prev, { step: '' }])
  }, [])

  const removeInstruction = useCallback((index: number) => {
    setInstructions(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)
  }, [])

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Saknas', 'Receptnamn är obligatoriskt.')
      return
    }
    if (!description.trim()) {
      Alert.alert('Saknas', 'Beskrivning är obligatorisk.')
      return
    }

    const validIngredients = ingredients.filter(i => i.name.trim())
    if (validIngredients.length === 0) {
      Alert.alert('Saknas', 'Lägg till minst en ingrediens.')
      return
    }

    const validInstructions = instructions.filter(i => i.step.trim())
    if (validInstructions.length === 0) {
      Alert.alert('Saknas', 'Lägg till minst en instruktion.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        servings: servings.trim(),
        prepTime: prepTime.trim(),
        cookTime: cookTime.trim(),
        categories: selectedCategories,
        ingredients: validIngredients.map(i => ({
          name: i.name.trim(),
          quantity: i.quantity.trim(),
          measurement: i.measurement.trim(),
        })),
        instructions: validInstructions.map(i => ({ step: i.step.trim() })),
      })
    } catch (err) {
      Alert.alert('Fel', err instanceof Error ? err.message : 'Kunde inte spara receptet.')
    } finally {
      setSaving(false)
    }
  }, [name, description, servings, prepTime, cookTime, selectedCategories, ingredients, instructions, onSave])

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <TouchableOpacity onPress={() => void handleSave()} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#16a34a" />
              ) : (
                <Text style={styles.saveButton}>Spara</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={isIOS ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Grundläggande</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="Receptnamn *"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
                autoFocus={!recipe}
              />
              <View style={styles.divider} />
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Beskrivning *"
                placeholderTextColor="#9ca3af"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={styles.rowField}>
                  <TextInput
                    style={styles.input}
                    placeholder="Portioner"
                    placeholderTextColor="#9ca3af"
                    value={servings}
                    onChangeText={setServings}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.rowDivider} />
                <View style={styles.rowField}>
                  <TextInput
                    style={styles.input}
                    placeholder="Förb. (min)"
                    placeholderTextColor="#9ca3af"
                    value={prepTime}
                    onChangeText={setPrepTime}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.rowDivider} />
                <View style={styles.rowField}>
                  <TextInput
                    style={styles.input}
                    placeholder="Tillagn. (min)"
                    placeholderTextColor="#9ca3af"
                    value={cookTime}
                    onChangeText={setCookTime}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kategorier</Text>
            <TouchableOpacity
              style={styles.card}
              onPress={() => setShowCategoryPicker(true)}
              activeOpacity={0.7}
            >
              <View style={styles.pickerRow}>
                {selectedCategories.length === 0 ? (
                  <Text style={styles.placeholder}>Välj kategorier...</Text>
                ) : (
                  <View style={styles.chipRow}>
                    {selectedCategories.map(cat => (
                      <View key={cat} style={styles.chip}>
                        <Text style={styles.chipText}>{cat}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Ingredients */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ingredienser</Text>
              <TouchableOpacity onPress={addIngredient} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="add-circle" size={28} color="#16a34a" />
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {ingredients.map((ing, idx) => (
                <View key={idx}>
                  {idx > 0 && <View style={styles.divider} />}
                  <View style={styles.ingredientRow}>
                    <TextInput
                      style={styles.ingredientQty}
                      placeholder="Mängd"
                      placeholderTextColor="#9ca3af"
                      value={ing.quantity}
                      onChangeText={v => updateIngredient(idx, 'quantity', v)}
                    />
                    <TextInput
                      style={styles.ingredientUnit}
                      placeholder="Enhet"
                      placeholderTextColor="#9ca3af"
                      value={ing.measurement}
                      onChangeText={v => updateIngredient(idx, 'measurement', v)}
                    />
                    <TextInput
                      style={styles.ingredientName}
                      placeholder="Ingrediens *"
                      placeholderTextColor="#9ca3af"
                      value={ing.name}
                      onChangeText={v => updateIngredient(idx, 'name', v)}
                    />
                    {ingredients.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeIngredient(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Instruktioner</Text>
              <TouchableOpacity onPress={addInstruction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="add-circle" size={28} color="#16a34a" />
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {instructions.map((inst, idx) => (
                <View key={idx}>
                  {idx > 0 && <View style={styles.divider} />}
                  <View style={styles.instructionRow}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepNumber}>{idx + 1}</Text>
                    </View>
                    <TextInput
                      style={styles.instructionInput}
                      placeholder="Beskriv steget..."
                      placeholderTextColor="#9ca3af"
                      value={inst.step}
                      onChangeText={v => updateInstruction(idx, v)}
                      multiline
                    />
                    {instructions.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeInstruction(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.removeButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      <CategoryPicker
        visible={showCategoryPicker}
        groups={categoryGroups}
        selected={selectedCategories}
        onToggle={(cat) => {
          setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
          )
        }}
        onClose={() => setShowCategoryPicker(false)}
      />
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
  saveButton: {
    color: '#16a34a',
    fontSize: 17,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingRight: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
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
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginLeft: 16,
  },
  row: {
    flexDirection: 'row',
  },
  rowField: {
    flex: 1,
  },
  rowDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  placeholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  chip: {
    backgroundColor: '#f0fdf4',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '500',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    gap: 2,
  },
  ingredientQty: {
    width: 60,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    textAlign: 'center',
  },
  ingredientUnit: {
    width: 64,
    paddingHorizontal: 8,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  ingredientName: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  stepNumber: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  instructionInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 4,
    minHeight: 32,
  },
  removeButton: {
    marginTop: 4,
  },
  bottomSpacer: {
    height: 40,
  },
})
