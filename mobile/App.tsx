import "./global.css";

import { StatusBar } from "expo-status-bar";
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

/**
 * NOTHING BLOCKS THE APP FROM RENDERING.
 *
 * The first version of this held the UI behind `useFonts` so the type wouldn't
 * reflow when Archivo arrived. That shipped a build that never got past a black
 * screen: expo-font was installed at the wrong major version for this SDK
 * (npm install instead of npx expo install), so the native module never came
 * up, `loaded` never turned true, `error` never fired either — and the gate had
 * no way out.
 *
 * The lesson is not "pin the version". It is that a loading gate with no
 * timeout and no failure path turns any problem underneath it into a dead app.
 * React Native falls back to the system face for a family it can't find, so the
 * worst case without the gate is a brief reflow and, if fonts are genuinely
 * broken, an app that looks wrong and still works.
 *
 * useFonts is still called — it loads them and re-renders when they land. Its
 * result is deliberately ignored.
 */
export default function App() {
  useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_900Black,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  return (
    <AppProviders>
      <RootNavigator />
      <StatusBar style="light" />
    </AppProviders>
  );
}
