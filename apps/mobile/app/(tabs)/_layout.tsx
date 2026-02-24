import { TouchableOpacity } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabLayout() {
  const router = useRouter()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#16a34a',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Recept',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={size} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/recipe/new')}
              style={{ marginRight: 16 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add-circle" size={28} color="#16a34a" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="shopping-list"
        options={{
          title: 'Inköpslista',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
