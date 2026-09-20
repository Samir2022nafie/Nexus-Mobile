import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../src/constants/theme';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <MaterialIcons name="error-outline" size={64} color={Colors.outlineVariant} />
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.subtitle}>The page you're looking for doesn't exist.</Text>
      <TouchableOpacity onPress={() => router.replace('/')} style={styles.button}>
        <Text style={styles.buttonText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, padding: Spacing.xl, gap: Spacing.md },
  title: { ...Typography.headlineSm, color: Colors.onSurface },
  subtitle: { ...Typography.bodyMd, color: Colors.outline, textAlign: 'center' },
  button: { marginTop: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: 12, backgroundColor: Colors.primary },
  buttonText: { ...Typography.labelMd, color: Colors.onPrimary },
});
