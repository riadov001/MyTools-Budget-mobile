import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import apiClient from "@/src/api/client";

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleReset = async () => {
    if (!password.trim()) {
      Alert.alert("Erreur", "Veuillez saisir un nouveau mot de passe.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas.");
      return;
    }
    if (!token) {
      Alert.alert("Erreur", "Lien invalide ou expiré. Demandez un nouveau lien de réinitialisation.");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post("/api/auth/reset-password", { token, password });
      setIsDone(true);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      const message =
        axiosError?.response?.data?.message ||
        "Une erreur est survenue. Le lien est peut-être expiré. Demandez un nouveau lien.";
      Alert.alert("Erreur", message);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: Math.max(insets.top + 24, 60),
      paddingBottom: Math.max(insets.bottom + 24, 40),
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 32,
    },
    backText: {
      fontSize: 14,
      fontFamily: "Exo2_500Medium",
      color: colors.textSecondary,
    },
    iconBadge: {
      width: 64,
      height: 64,
      borderRadius: 18,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      lineHeight: 21,
      marginBottom: 32,
    },
    label: {
      fontSize: 13,
      fontFamily: "Exo2_500Medium",
      color: colors.textSecondary,
      marginBottom: 6,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.elevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    input: {
      flex: 1,
      height: 48,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: "Exo2_400Regular",
      color: colors.foreground,
    },
    eyeButton: {
      padding: 12,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    submitButtonText: {
      fontSize: 16,
      fontFamily: "Exo2_600SemiBold",
      color: "#FFFFFF",
    },
    successContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    successIconBadge: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: colors.success + "20",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    successTitle: {
      fontSize: 22,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
      textAlign: "center",
      marginBottom: 12,
    },
    successText: {
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 21,
      marginBottom: 32,
    },
    loginButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "stretch",
    },
    loginButtonText: {
      fontSize: 16,
      fontFamily: "Exo2_600SemiBold",
      color: "#FFFFFF",
    },
  });

  if (isDone) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <View style={styles.successIconBadge}>
          <Ionicons name="checkmark-circle" size={40} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>Mot de passe mis à jour !</Text>
        <Text style={styles.successText}>
          Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
        </Text>
        <Pressable style={styles.loginButton} onPress={() => router.replace("/welcome")}>
          <Text style={styles.loginButtonText}>Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backButton} onPress={() => router.replace("/welcome")}>
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
          <Text style={styles.backText}>Retour à la connexion</Text>
        </Pressable>

        <View style={styles.iconBadge}>
          <Ionicons name="lock-closed-outline" size={28} color={colors.primary} />
        </View>

        <Text style={styles.title}>Nouveau mot de passe</Text>
        <Text style={styles.subtitle}>
          Choisissez un mot de passe sécurisé d'au moins 6 caractères.
        </Text>

        <Text style={styles.label}>Nouveau mot de passe</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        </View>

        <Text style={styles.label}>Confirmer le mot de passe</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.eyeButton} onPress={() => setShowConfirm((v) => !v)}>
            <Ionicons
              name={showConfirm ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        </View>

        <Pressable
          style={[styles.submitButton, isLoading && { opacity: 0.7 }]}
          onPress={handleReset}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Réinitialiser le mot de passe</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
