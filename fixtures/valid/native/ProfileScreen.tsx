import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useProfileScreen } from '../../../lib/hooks/useProfileScreen';

interface ProfileRowProps {
  label: string;
}

const ProfileRow = ({ label }: ProfileRowProps) => (
  <Text style={styles.row}>{label}</Text>
);

interface ProfileScreenProps {
  userId: string;
}

export const ProfileScreen = ({ userId }: ProfileScreenProps) => {
  const { entries, fadeStyle, showNativeChrome, handleSelect } =
    useProfileScreen(userId);

  return (
    <View style={styles.container}>
      {showNativeChrome && <Text>Native chrome</Text>}
      <Animated.View style={fadeStyle} />
      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => <ProfileRow label={item.label} />}
      />
      <Pressable onPress={() => handleSelect(userId)}>
        <Text>Select</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { paddingVertical: Platform.select({ ios: 12, android: 8 }) },
});
