import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import apiClient from "@/src/api/client";

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loginWithEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const features = [
    { icon: "scan-outline" as const, title: "Scan OCR", desc: "Numérisez vos factures instantanément" },
    { icon: "wallet-outline" as const, title: "Budget tracker", desc: "Suivez vos dépenses en temps réel" },
    { icon: "calendar-outline" as const, title: "Agenda fiscal", desc: "Deadlines URSSAF & rappels" },
    { icon: "shield-checkmark-outline" as const, title: "RGPD", desc: "Vos données protégées et sécurisées" },
  ];

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Erreur", "Veuillez saisir votre email et mot de passe.");
      return;
    }
    setIsLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string }; status?: number };
        message?: string;
        code?: string;
      };
      let message = "Une erreur est survenue. Veuillez réessayer.";
      if (axiosError?.response?.data?.message) {
        message = axiosError.response.data.message;
      } else if (axiosError?.code === "ERR_NETWORK" || axiosError?.message?.includes("Network")) {
        message =
          "Impossible de contacter le serveur. Vérifiez votre connexion internet ou testez avec l'app Expo Go sur votre téléphone (le navigateur web bloque parfois les requêtes externes).";
      } else if (axiosError?.response?.status === 401) {
        message = "Identifiants incorrects. Vérifiez votre email et mot de passe.";
      } else if (axiosError?.response?.status === 400) {
        message = "Requête invalide. Vérifiez le format de votre email et que votre mot de passe comporte au moins 6 caractères.";
      }
      Alert.alert("Connexion échouée", message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert("Erreur", "Veuillez saisir votre adresse email.");
      return;
    }
    setIsSendingReset(true);
    try {
      await apiClient.post("/api/auth/forgot-password", { email: forgotEmail.trim() });
      setResetSent(true);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      const message =
        axiosError?.response?.data?.message ||
        "Une erreur est survenue. Vérifiez votre connexion et réessayez.";
      Alert.alert("Erreur", message);
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleCloseForgotModal = () => {
    setShowForgotModal(false);
    setForgotEmail("");
    setResetSent(false);
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
    logoContainer: {
      alignItems: "center",
      marginBottom: 32,
    },
    logoBadge: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    appName: {
      fontSize: 26,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
      textAlign: "center",
      letterSpacing: -0.5,
    },
    tagline: {
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 6,
      lineHeight: 20,
    },
    featuresGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 32,
    },
    featureCard: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    featureTitle: {
      fontSize: 13,
      fontFamily: "Exo2_600SemiBold",
      color: colors.foreground,
      marginTop: 8,
    },
    featureDesc: {
      fontSize: 11,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
      marginTop: 3,
      lineHeight: 15,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "Exo2_600SemiBold",
      color: colors.foreground,
      marginBottom: 16,
    },
    inputLabel: {
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
      marginBottom: 14,
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
    passwordRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    forgotLink: {
      fontSize: 12,
      fontFamily: "Exo2_500Medium",
      color: colors.primary,
    },
    loginButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    loginButtonText: {
      fontSize: 16,
      fontFamily: "Exo2_600SemiBold",
      color: "#FFFFFF",
      letterSpacing: 0.3,
    },
    footer: {
      alignItems: "center",
      marginTop: 24,
    },
    footerText: {
      fontSize: 11,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: Math.max(insets.bottom + 24, 40),
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.elevated,
      alignItems: "center",
      justifyContent: "center",
    },
    modalSubtitle: {
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      lineHeight: 21,
      marginBottom: 20,
    },
    modalLabel: {
      fontSize: 13,
      fontFamily: "Exo2_500Medium",
      color: colors.textSecondary,
      marginBottom: 6,
    },
    modalInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.elevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    modalInput: {
      flex: 1,
      height: 48,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: "Exo2_400Regular",
      color: colors.foreground,
    },
    modalSubmitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
    },
    modalSubmitBtnText: {
      fontSize: 16,
      fontFamily: "Exo2_600SemiBold",
      color: "#FFFFFF",
    },
    successContainer: {
      alignItems: "center",
      paddingVertical: 12,
    },
    successIconBadge: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.success + "20",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    successTitle: {
      fontSize: 18,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
      textAlign: "center",
      marginBottom: 8,
    },
    successText: {
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 21,
      marginBottom: 24,
    },
    successCloseBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "stretch",
    },
    successCloseBtnText: {
      fontSize: 16,
      fontFamily: "Exo2_600SemiBold",
      color: "#FFFFFF",
    },
  });

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="bar-chart" size={38} color="#FFFFFF" />
            </View>
            <Text style={styles.appName}>Budget by MyTools</Text>
            <Text style={styles.tagline}>
              Gérez votre comptabilité en toute simplicité
            </Text>
          </View>

          <View style={styles.featuresGrid}>
            {features.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <Ionicons name={f.icon} size={22} color={colors.primary} />
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Se connecter par email</Text>

          <Text style={styles.inputLabel}>Adresse email</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="votre@email.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="email-input"
            />
          </View>

          <View style={styles.passwordRow}>
            <Text style={styles.inputLabel}>Mot de passe</Text>
            <Pressable onPress={() => { setForgotEmail(email); setShowForgotModal(true); }}>
              <Text style={styles.forgotLink}>Mot de passe oublié ?</Text>
            </Pressable>
          </View>
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
              testID="password-input"
            />
            <Pressable
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          <Pressable
            style={[styles.loginButton, isLoading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={isLoading}
            testID="login-button"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Se connecter</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Budget by MyTools · mytoolsgroup.eu
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="slide"
        onRequestClose={handleCloseForgotModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseForgotModal}>
          <Pressable onPress={() => {}}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Mot de passe oublié</Text>
                <Pressable style={styles.modalCloseBtn} onPress={handleCloseForgotModal}>
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              {resetSent ? (
                <View style={styles.successContainer}>
                  <View style={styles.successIconBadge}>
                    <Ionicons name="mail-outline" size={32} color={colors.success} />
                  </View>
                  <Text style={styles.successTitle}>Email envoyé !</Text>
                  <Text style={styles.successText}>
                    Si un compte existe avec l'adresse{" "}
                    <Text style={{ fontFamily: "Exo2_600SemiBold", color: colors.foreground }}>
                      {forgotEmail}
                    </Text>
                    , vous recevrez un lien de réinitialisation dans quelques instants.{"\n\n"}
                    Pensez à vérifier vos spams.
                  </Text>
                  <Pressable style={styles.successCloseBtn} onPress={handleCloseForgotModal}>
                    <Text style={styles.successCloseBtnText}>Retour à la connexion</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={styles.modalSubtitle}>
                    Saisissez l'adresse email associée à votre compte. Vous recevrez un lien pour réinitialiser votre mot de passe.
                  </Text>

                  <Text style={styles.modalLabel}>Adresse email</Text>
                  <View style={styles.modalInputWrapper}>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="votre@email.com"
                      placeholderTextColor={colors.textMuted}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                  </View>

                  <Pressable
                    style={[styles.modalSubmitBtn, isSendingReset && { opacity: 0.7 }]}
                    onPress={handleForgotPassword}
                    disabled={isSendingReset}
                  >
                    {isSendingReset ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalSubmitBtnText}>Envoyer le lien</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
