import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useVault } from '@/components/Providers/VaultProvider'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'

export default function ProfileTab() {
  const { lock } = useVault()
  const router = useRouter()

  const handleLock = useCallback(async () => {
    await lock()
    router.replace('/(auth)/calculator')
  }, [lock, router])

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-primary">
      <Text className="text-secondary text-xl font-fira-code">Profile</Text>
      <TouchableOpacity
        onPress={handleLock}
        className="mt-4 bg-primary-500 p-4 rounded-2xl"
      >
        <Text className="text-secondary-400 font-fira-code">/lock vault</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}
