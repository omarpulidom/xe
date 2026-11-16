import { Colors } from '@/components/colors'
import { AntDesign, Ionicons } from '@expo/vector-icons'
import { useState, useRef, useEffect } from 'react'
import { Text, TouchableOpacity, View, ScrollView, Modal, Pressable } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

interface SelectOption {
  label: string
  value: string
}

interface SelectInputProps {
  options: SelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  icon?: keyof typeof Ionicons.glyphMap
  error?: boolean
  className?: string
}

function SelectInput({
  options,
  value,
  onValueChange,
  placeholder,
  icon,
  error = false,
  className,
}: SelectInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [buttonLayout, setButtonLayout] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const buttonRef = useRef<View>(null)
  const scrollViewRef = useRef<ScrollView>(null)

  const selectedOption = options.find((opt) => opt.value === value)
  const selectedIndex = options.findIndex((opt) => opt.value === value)

  const handleOpen = () => {
    buttonRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setButtonLayout({ x: pageX, y: pageY, width, height })
      setIsOpen(true)
    })
  }

  // Auto-scroll to selected option when dropdown opens
  useEffect(() => {
    if (isOpen && selectedIndex >= 0 && scrollViewRef.current) {
      setTimeout(() => {
        const itemHeight = 40
        const scrollToY = selectedIndex * itemHeight
        scrollViewRef.current?.scrollTo({ y: scrollToY, animated: true })
      }, 100)
    }
  }, [isOpen, selectedIndex])

  return (
    <>
      {/* Select Button */}
      <View ref={buttonRef} collapsable={false} className={className}>
        <TouchableOpacity
          onPress={handleOpen}
          className={`flex-row items-center px-3 py-2 rounded-xl border ${error ? 'border-primary-500 bg-primary-100' : 'border-primary-300 bg-primary'
            }`}
          activeOpacity={0.7}
        >
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={error ? Colors.primary[500] : Colors.secondary[400]}
            />
          )}
          <Text
            className={`flex-1 ${icon ? 'ml-3' : ''} text-lg text-center ${selectedOption ? 'text-secondary-400 font-fira-code-semibold' : 'text-secondary-500 font-fira-code-medium'
              }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.secondary[400]}
          />
        </TouchableOpacity>
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className='flex-1'
          onPress={() => setIsOpen(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={{
              position: 'absolute',
              top: buttonLayout.y + buttonLayout.height + 8,
              left: buttonLayout.x,
              width: buttonLayout.width,
              maxHeight: 240,
            }}
            className='bg-primary-500 border border-primary-400 rounded-xl shadow-2xl overflow-hidden'
          >
            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              className='py-1'
              bounces={false}
            >
              {options.map((option, index) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => {
                    onValueChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`px-3 py-3 flex-row items-center justify-between ${index !== options.length - 1 ? 'border-b border-primary-400' : ''
                    }`}
                  activeOpacity={0.6}
                >
                  <Text
                    className={`text-base flex-1 ${value === option.value
                      ? 'text-secondary font-fira-code-medium'
                      : 'text-secondary-500 font-fira-code'
                      }
                      text-center`}
                  >
                    {option.label}
                  </Text>
                  {value === option.value && (
                    <View className='bg-primary-400 h-6 w-6 rounded-lg items-center justify-center'>
                      <AntDesign
                        name='enter'
                        size={14}
                        color={Colors.secondary[400]}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  )
}

export default SelectInput
