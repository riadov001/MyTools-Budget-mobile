import React from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import apiClient from "@/src/api/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, deleteAccount } = useAuth();
  const [legalModal, setLegalModal] = React.useState<{ title: string; text: string } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const fetchLegal = async (path: string) => {
    const res = await apiClient.get<{ text?: string; content?: string } | string>(path);
    if (typeof res.data === "string") return res.data;
    return (res.data as { text?: string; content?: string }).text || (res.data as { text?: string; content?: string }).content || JSON.stringify(res.data);
  };

  const handleShowLegal = async (title: string, path: string) => {
    try {
      const text = await fetchLegal(path);
      setLegalModal({ title, text });
    } catch {
      Alert.alert("Erreur", "Impossible de charger le document.");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Se déconnecter",
      "Voulez-vous vous déconnecter de Budget by MyTools ?",
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

  const handleDeleteAccount = () => {
    Alert.alert(
      "Supprimer mon compte",
      "Cette action est irréversible. Toutes vos données seront supprimées conformément au RGPD. Voulez-vous continuer ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer définitivement",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteAccount();
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer le compte. Réessayez.");
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const initials = (() => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.name) {
      const parts = user.name.split(" ");
      return parts.length >= 2
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : user.name.slice(0, 2).toUpperCase();
    }
    return user?.email?.slice(0, 2).toUpperCase() || "?";
  })();

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.name || user?.email || "";

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingTop: Math.max(insets.top, Platform.OS === "web" ? 67 : 0) + 16,
      paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 34 : 0) + 80,
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 24,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
      marginBottom: 24,
    },
    avatarCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      alignItems: "center",
      marginBottom: 20,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    avatarText: {
      fontSize: 26,
      fontFamily: "Exo2_700Bold",
      color: "#FFFFFF",
    },
    userName: {
      fontSize: 18,
      fontFamily: "Exo2_600SemiBold",
      color: colors.foreground,
      textAlign: "center",
    },
    userEmail: {
      fontSize: 13,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: "center",
    },
    roleBadge: {
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: colors.primary + "20",
    },
    roleText: {
      fontSize: 12,
      fontFamily: "Exo2_600SemiBold",
      color: colors.primary,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: "Exo2_600SemiBold",
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 10,
      marginTop: 4,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    rowLabel: {
      fontSize: 14,
      fontFamily: "Exo2_500Medium",
      color: colors.foreground,
    },
    rowValue: {
      fontSize: 12,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      marginTop: 2,
    },
    consentIcon: {
      marginLeft: 4,
    },
    legalArrow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    dangerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dangerRowLast: {
      borderBottomWidth: 0,
    },
    dangerLabel: {
      fontSize: 14,
      fontFamily: "Exo2_500Medium",
      color: colors.primary,
    },
    footer: {
      alignItems: "center",
      paddingTop: 8,
      paddingBottom: 8,
    },
    footerText: {
      fontSize: 11,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "80%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontFamily: "Exo2_600SemiBold",
      color: colors.foreground,
    },
    modalBody: {
      padding: 20,
    },
    modalText: {
      fontSize: 13,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Profil</Text>

      <View style={styles.avatarCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        {user?.role && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user.role}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Consentements RGPD</Text>
      <View style={styles.sectionCard}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons
              name={user?.consentCguAt ? "checkmark-circle" : "close-circle"}
              size={20}
              color={user?.consentCguAt ? colors.success : colors.primary}
            />
            <View>
              <Text style={styles.rowLabel}>CGU</Text>
              <Text style={styles.rowValue}>
                {user?.consentCguAt
                  ? `Acceptées le ${formatDate(user.consentCguAt)}`
                  : "Non acceptées"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons
              name={user?.consentPrivacyAt ? "checkmark-circle" : "close-circle"}
              size={20}
              color={user?.consentPrivacyAt ? colors.success : colors.primary}
            />
            <View>
              <Text style={styles.rowLabel}>Politique de confidentialité</Text>
              <Text style={styles.rowValue}>
                {user?.consentPrivacyAt
                  ? `Acceptée le ${formatDate(user.consentPrivacyAt)}`
                  : "Non acceptée"}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <View style={styles.rowLeft}>
            <Ionicons
              name={user?.consentCookiesAt ? "checkmark-circle" : "close-circle"}
              size={20}
              color={user?.consentCookiesAt ? colors.success : colors.textMuted}
            />
            <View>
              <Text style={styles.rowLabel}>Cookies & analytics</Text>
              <Text style={styles.rowValue}>
                {user?.consentCookiesAt ? "Acceptés" : "Refusés"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Mentions légales</Text>
      <View style={styles.sectionCard}>
        {[
          { label: "Conditions d'utilisation", path: "/api/legal/cgu" },
          { label: "Politique de confidentialité", path: "/api/legal/privacy" },
          { label: "Mentions légales", path: "/api/legal/mentions" },
        ].map((item, idx, arr) => (
          <Pressable
            key={item.path}
            style={[styles.row, idx === arr.length - 1 && styles.rowLast]}
            onPress={() => handleShowLegal(item.label, item.path)}
          >
            <Text style={styles.rowLabel}>{item.label}</Text>
            <View style={styles.legalArrow}>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Compte</Text>
      <View style={styles.sectionCard}>
        <Pressable
          style={styles.dangerRow}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.dangerLabel, { color: colors.foreground }]}>
            Se déconnecter
          </Text>
        </Pressable>
        <Pressable
          style={[styles.dangerRow, styles.dangerRowLast]}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="trash-outline" size={20} color={colors.primary} />
          )}
          <Text style={styles.dangerLabel}>Supprimer mon compte</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Budget by MyTools · mytoolsgroup.eu · v1.0.0
        </Text>
      </View>

      <Modal
        visible={!!legalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setLegalModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{legalModal?.title}</Text>
              <Pressable onPress={() => setLegalModal(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalText}>{legalModal?.text}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
