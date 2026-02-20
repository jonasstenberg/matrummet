import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Platform,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import type { Recipe, CategoryGroup } from '@matrummet/types/types'
import { api } from '@/lib/api'
import { useAuth } from '@/providers/auth-provider'
import { RecipeCard } from '@/components/recipe-card'
import { CategoryChips } from '@/components/category-chips'

const PAGE_SIZE = 20
const isIOS = Platform.OS === 'ios'
const FLOATING_BAR_HEIGHT = 64

export default function RecipesScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const tabBarHeight = useBottomTabBarHeight()

  // Browse state
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Search state
  const [query, setQuery] = useState('')
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([])
  const [searchResults, setSearchResults] = useState<Recipe[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const searchInputRef = useRef<TextInput>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keyboardOffset = useSharedValue(0)

  const isSearchMode = isSearchActive || query.length > 0 || selectedCategories.length > 0

  // Load categories
  useEffect(() => {
    if (user) api.getCategories().then(setCategoryGroups).catch(console.error)
  }, [user])

  // iOS: keyboard tracking for floating bar
  useEffect(() => {
    if (!isIOS) return

    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      keyboardOffset.value = withTiming(e.endCoordinates.height - tabBarHeight, {
        duration: e.duration,
        easing: Easing.out(Easing.cubic),
      })
    })
    const hideSub = Keyboard.addListener('keyboardWillHide', (e) => {
      keyboardOffset.value = withTiming(0, {
        duration: e.duration,
        easing: Easing.out(Easing.cubic),
      })
    })
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [tabBarHeight])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Browse: load recipes
  const loadRecipes = useCallback(async (reset = false) => {
    const newOffset = reset ? 0 : offset
    try {
      const data = await api.getRecipes({ limit: PAGE_SIZE, offset: newOffset })
      if (reset) {
        setRecipes(data)
      } else {
        setRecipes((prev) => [...prev, ...data])
      }
      setHasMore(data.length === PAGE_SIZE)
      setOffset(newOffset + data.length)
    } catch (err) {
      console.error('Failed to load recipes:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [offset])

  useEffect(() => {
    if (user) loadRecipes(true)
  }, [user])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setOffset(0)
    loadRecipes(true)
  }, [loadRecipes])

  const onEndReached = useCallback(() => {
    if (!loading && hasMore) {
      loadRecipes(false)
    }
  }, [loading, hasMore, loadRecipes])

  // Search
  const doSearch = useCallback(async (searchQuery: string, categories: string[]) => {
    if (!searchQuery.trim() && categories.length === 0) {
      setSearchResults([])
      setHasSearched(false)
      return
    }
    setSearchLoading(true)
    setHasSearched(true)
    try {
      const data = await api.getRecipes({
        search: searchQuery.trim() || undefined,
        categories: categories.length > 0 ? categories : undefined,
        limit: 50,
      })
      setSearchResults(data)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const onQueryChange = useCallback((text: string) => {
    setQuery(text)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      doSearch(text, selectedCategories)
    }, 300)
  }, [selectedCategories, doSearch])

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
      doSearch(query, next)
      return next
    })
  }, [query, doSearch])

  const cancelSearch = useCallback(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setIsSearchActive(false)
    setQuery('')
    setSelectedCategories([])
    setSearchResults([])
    setHasSearched(false)
    searchInputRef.current?.blur()
  }, [])

  const onSearchFocus = useCallback(() => {
    setIsSearchActive(true)
  }, [])

  const clearQuery = useCallback(() => {
    setQuery('')
    if (selectedCategories.length > 0) {
      doSearch('', selectedCategories)
    } else {
      setSearchResults([])
      setHasSearched(false)
    }
  }, [selectedCategories, doSearch])

  // iOS: animated floating bar style
  const floatingBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardOffset.value }],
  }))

  const listData = isSearchMode ? searchResults : recipes
  const isListLoading = isSearchMode ? searchLoading : (loading && recipes.length === 0)

  const listEmptyComponent = isListLoading ? (
    <View style={styles.emptyContainer}>
      <ActivityIndicator size="large" color="#16a34a" />
    </View>
  ) : isSearchMode && hasSearched ? (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Inga recept matchade din sökning</Text>
    </View>
  ) : !isSearchMode ? (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Inga recept hittades</Text>
    </View>
  ) : null

  if (loading && recipes.length === 0 && !isSearchMode) {
    return (
      <View style={[styles.centered, isIOS ? styles.iosBg : styles.androidBg]}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    )
  }

  // ──────────────────────────────────────────
  // iOS: floating bottom search bar (iOS 26)
  // ──────────────────────────────────────────
  if (isIOS) {
    return (
      <View style={[styles.container, styles.iosBg]}>
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecipeCard recipe={item} onPress={() => router.push(`/recipe/${item.id}`)} />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: FLOATING_BAR_HEIGHT + (isSearchMode ? 52 : 0) },
          ]}
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            !isSearchMode ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />
            ) : undefined
          }
          onEndReached={!isSearchMode ? onEndReached : undefined}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={listEmptyComponent}
        />
        <Animated.View style={[styles.iosFloatingContainer, floatingBarStyle]}>
          {isSearchMode && categoryGroups.length > 0 && (
            <CategoryChips
              groups={categoryGroups}
              selected={selectedCategories}
              onToggle={toggleCategory}
            />
          )}
          <View style={styles.iosFloatingRow}>
            <View style={styles.iosSearchPill}>
              <Ionicons name="search" size={17} color="#8e8e93" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.iosSearchInput}
                placeholder="Sök recept"
                placeholderTextColor="#8e8e93"
                value={query}
                onChangeText={onQueryChange}
                onFocus={onSearchFocus}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={clearQuery}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={17} color="#8e8e93" />
                </TouchableOpacity>
              )}
            </View>
            {isSearchActive && (
              <TouchableOpacity onPress={cancelSearch} style={styles.cancelButton}>
                <Text style={styles.iosCancelText}>Avbryt</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    )
  }

  // ──────────────────────────────────────────
  // Android: top search bar (Material Design 3)
  // ──────────────────────────────────────────
  return (
    <FlatList
      data={listData}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <RecipeCard recipe={item} onPress={() => router.push(`/recipe/${item.id}`)} />
      )}
      ListHeaderComponent={
        <View style={styles.androidHeader}>
          <View style={styles.androidSearchRow}>
            <View style={styles.androidSearchPill}>
              <Ionicons name="search" size={20} color="#49454f" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.androidSearchInput}
                placeholder="Sök recept"
                placeholderTextColor="#49454f"
                value={query}
                onChangeText={onQueryChange}
                onFocus={onSearchFocus}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={clearQuery}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color="#49454f" />
                </TouchableOpacity>
              )}
            </View>
            {isSearchActive && (
              <TouchableOpacity onPress={cancelSearch} style={styles.cancelButton}>
                <Text style={styles.androidCancelText}>Avbryt</Text>
              </TouchableOpacity>
            )}
          </View>
          {isSearchMode && categoryGroups.length > 0 && (
            <CategoryChips
              groups={categoryGroups}
              selected={selectedCategories}
              onToggle={toggleCategory}
            />
          )}
        </View>
      }
      contentContainerStyle={styles.listContent}
      style={[styles.list, styles.androidBg]}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        !isSearchMode ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />
        ) : undefined
      }
      onEndReached={!isSearchMode ? onEndReached : undefined}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={listEmptyComponent}
    />
  )
}

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosBg: {
    backgroundColor: '#f2f2f7',
  },
  androidBg: {
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
  },
  separator: {
    height: 12,
  },

  // Shared
  searchIcon: {
    marginRight: 8,
  },
  cancelButton: {
    marginLeft: 12,
  },

  // ── iOS floating bottom bar ──
  iosFloatingContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
    backgroundColor: 'rgba(242,242,247,0.85)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60,60,67,0.29)',
  },
  iosFloatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  iosSearchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  iosSearchInput: {
    flex: 1,
    fontSize: 17,
    color: '#000000',
    paddingVertical: 0,
  },
  iosCancelText: {
    color: '#007aff',
    fontSize: 17,
  },

  // ── Android top search (Material Design 3) ──
  androidHeader: {
    marginBottom: 12,
  },
  androidSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  androidSearchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7e0ec',
    borderRadius: 28,
    paddingHorizontal: 16,
    height: 48,
    elevation: 1,
  },
  androidSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1d1b20',
    paddingVertical: 0,
  },
  androidCancelText: {
    color: '#6750a4',
    fontSize: 14,
    fontWeight: '500',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#8e8e93',
    fontSize: 16,
  },
})
