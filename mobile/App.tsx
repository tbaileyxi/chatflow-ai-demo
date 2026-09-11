import "./global.css";

import { useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_900Black,
} from "@expo-google-fonts/archivo";
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { AppProviders } from "@/providers/AppProviders";
import { RootNavigator } from "@/navigation/RootNavigator";
import { colors } from "@/theme/colors";

// Hold the splash until the faces are in memory. Without this the first frame
// renders in system San Francisco and then reflows when Archivo arrives — the
// whole app visibly jumps, which reads as a bug rather than a load.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsReady, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_900Black,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  // A font that fails to load must not hold the app hostage. React Native
  // falls back to the system face for any family it can't find, so the app
  // still works — it just looks wrong, which beats a permanent splash screen.
  const ready = fontsReady || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <AppProviders>
      <RootNavigator />
      <StatusBar style="light" />
    </AppProviders>
  );
}
