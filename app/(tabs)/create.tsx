/**
 * Create Tab / Fallback Screen — Re-exports CreateBottomSheet with auto-visible
 * and dismiss navigation back.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { CreateBottomSheet } from '../../src/components/CreateBottomSheet';

export default function CreateSheetScreen() {
  const router = useRouter();

  return (
    <CreateBottomSheet
      visible={true}
      onClose={() => router.back()}
    />
  );
}
