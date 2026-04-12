import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ConsentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { recordConsent, logout } = useAuth();

  const [cgu, setCgu] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [cookies, setCookies] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = cgu && privacy;

  const handleAccept = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    try {
      await recordConsent(true, true, cookies);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      const message =
        axiosError?.response?.data?.message ||
        "Une erreur est survenue. Veuillez réessayer.";
      Alert.alert("Erreur", message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Se déconnecter",
      "Voulez-vous vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Se déconnecter",
          style: "destructive",
          onPress: logout,
        },
      ]
    );
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
    header: {
      alignItems: "center",
      marginBottom: 32,
    },
    iconBadge: {
      width: 64,
      height: 64,
      borderRadius: 18,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 22,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 20,
    },
    checkboxContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: "hidden",
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 16,
      gap: 14,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxTextContainer: {
      flex: 1,
    },
    checkboxTitle: {
      fontSize: 14,
      fontFamily: "Exo2_600SemiBold",
      color: colors.foreground,
      lineHeight: 20,
    },
    requiredBadge: {
      fontSize: 11,
      fontFamily: "Exo2_500Medium",
      color: colors.primary,
    },
    checkboxDesc: {
      fontSize: 12,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 17,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    submitButtonDisabled: {
      opacity: 0.4,
    },
    submitButtonText: {
      fontSize: 16,
      fontFamily: "Exo2_600SemiBold",
      color: "#FFFFFF",
    },
    logoutButton: {
      alignItems: "center",
      marginTop: 20,
      padding: 8,
    },
    logoutText: {
      fontSize: 14,
      fontFamily: "Exo2_500Medium",
      color: colors.textMuted,
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="shield-checkmark" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>Protection de vos données</Text>
        <Text style={styles.subtitle}>
          Avant de continuer, merci d'accepter nos conditions d'utilisation.
        </Text>
      </View>

      <Pressable
        style={styles.checkboxContainer}
        onPress={() => setCgu((v) => !v)}
      >
        <View style={styles.checkboxRow}>
          <View style={[styles.checkbox, cgu && styles.checkboxChecked]}>
            {cgu && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
          <View style={styles.checkboxTextContainer}>
            <Text style={styles.checkboxTitle}>
              Conditions Générales d'Utilisation{" "}
              <Text style={styles.requiredBadge}>*</Text>
            </Text>
            <Text style={styles.checkboxDesc}>
              J'ai lu et j'accepte les CGU de Budget by MyTools. Ces conditions
              définissent les règles d'utilisation du service.
            </Text>
          </View>
        </View>
      </Pressable>

      <Pressable
        style={styles.checkboxContainer}
        onPress={() => setPrivacy((v) => !v)}
      >
        <View style={styles.checkboxRow}>
          <View style={[styles.checkbox, privacy && styles.checkboxChecked]}>
            {privacy && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
          <View style={styles.checkboxTextContainer}>
            <Text style={styles.checkboxTitle}>
              Politique de confidentialité{" "}
              <Text style={styles.requiredBadge}>*</Text>
            </Text>
            <Text style={styles.checkboxDesc}>
              J'accepte la politique de confidentialité conforme au RGPD. Vos
              données personnelles sont traitées de manière sécurisée.
            </Text>
          </View>
        </View>
      </Pressable>

      <Pressable
        style={styles.checkboxContainer}
        onPress={() => setCookies((v) => !v)}
      >
        <View style={styles.checkboxRow}>
          <View style={[styles.checkbox, cookies && styles.checkboxChecked]}>
            {cookies && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
          <View style={styles.checkboxTextContainer}>
            <Text style={styles.checkboxTitle}>Cookies & analytics</Text>
            <Text style={styles.checkboxDesc}>
              J'accepte l'utilisation de cookies pour améliorer l'application
              et analyser les performances. (Facultatif)
            </Text>
          </View>
        </View>
      </Pressable>

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleAccept}
        disabled={!canSubmit || isLoading}
        testID="accept-button"
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Accepter et continuer</Text>
        )}
      </Pressable>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}
