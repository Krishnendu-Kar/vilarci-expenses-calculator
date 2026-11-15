import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** For opening a screen from outside one (a tapped notification). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
