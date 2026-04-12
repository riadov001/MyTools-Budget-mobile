import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import apiClient from "@/src/api/client";
import { format, isBefore, isThisMonth, addMonths } from "date-fns";
import { fr } from "date-fns/locale";

interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  date?: string;
}

const URSSAF_DEADLINES = [
  { date: "2025-01-31", label: "Déclaration CA T4 2024 + cotisations", quarter: "Q4" },
  { date: "2025-04-30", label: "Déclaration CA T1 2025 + cotisations", quarter: "Q1" },
  { date: "2025-05-31", label: "Déclaration annuelle revenus", quarter: "Annuel" },
  { date: "2025-07-31", label: "Déclaration CA T2 2025 + cotisations", quarter: "Q2" },
  { date: "2025-10-31", label: "Déclaration CA T3 2025 + cotisations", quarter: "Q3" },
  { date: "2026-01-31", label: "Déclaration CA T4 2025 + cotisations", quarter: "Q4" },
  { date: "2026-04-30", label: "Déclaration CA T1 2026 + cotisations", quarter: "Q1" },
  { date: "2026-05-31", label: "Déclaration annuelle revenus", quarter: "Annuel" },
  { date: "2026-07-31", label: "Déclaration CA T2 2026 + cotisations", quarter: "Q2" },
  { date: "2026-10-31", label: "Déclaration CA T3 2026 + cotisations", quarter: "Q3" },
];

export default function AgendaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const now = new Date();

  const { data: reminders } = useQuery<Reminder[]>({
    queryKey: ["reminders"],
    queryFn: async () => {
      const res = await apiClient.get<Reminder[] | { reminders: Reminder[] }>("/api/reminders");
      return Array.isArray(res.data) ? res.data : (res.data as { reminders: Reminder[] }).reminders || [];
    },
  });

  const isSoon = (dateStr: string) => {
    const d = new Date(dateStr);
    return isThisMonth(d) || isThisMonth(addMonths(d, -1));
  };

  const isPast = (dateStr: string) => {
    return isBefore(new Date(dateStr), now);
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
      marginBottom: 6,
    },
    todayCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 24,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    todayIconBox: {
      width: 44,
      height: 44,
      borderRadius: 10,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    todayDay: {
      fontSize: 22,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
    },
    todayDate: {
      fontSize: 13,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      marginTop: 2,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: "Exo2_600SemiBold",
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    deadlineCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    deadlineCardPast: {
      opacity: 0.45,
    },
    deadlineIconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    deadlineContent: {
      flex: 1,
    },
    deadlineLabel: {
      fontSize: 13,
      fontFamily: "Exo2_500Medium",
      color: colors.foreground,
      lineHeight: 18,
    },
    deadlineDate: {
      fontSize: 11,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      marginTop: 3,
    },
    soonBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors.primary + "20",
    },
    soonText: {
      fontSize: 10,
      fontFamily: "Exo2_600SemiBold",
      color: colors.primary,
    },
    quarterBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 5,
      backgroundColor: colors.elevated,
      marginTop: 4,
      alignSelf: "flex-start",
    },
    quarterText: {
      fontSize: 10,
      fontFamily: "Exo2_500Medium",
      color: colors.textMuted,
    },
    infoNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: colors.elevated,
      borderRadius: 10,
      padding: 12,
      marginTop: 4,
      marginBottom: 24,
      gap: 10,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      lineHeight: 17,
    },
    reminderCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    reminderContent: {
      flex: 1,
    },
    reminderTitle: {
      fontSize: 14,
      fontFamily: "Exo2_500Medium",
      color: colors.foreground,
    },
    reminderDesc: {
      fontSize: 12,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      marginTop: 3,
    },
    reminderDate: {
      fontSize: 11,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
      marginTop: 3,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
      textAlign: "center",
      paddingVertical: 16,
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Agenda</Text>

      <View style={styles.todayCard}>
        <View style={styles.todayIconBox}>
          <Ionicons name="calendar" size={22} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.todayDay}>
            {format(now, "d MMMM", { locale: fr })}
          </Text>
          <Text style={styles.todayDate}>
            {format(now, "EEEE yyyy", { locale: fr })}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Échéances URSSAF</Text>

      {URSSAF_DEADLINES.map((dl) => (
        <View
          key={dl.date}
          style={[styles.deadlineCard, isPast(dl.date) && styles.deadlineCardPast]}
        >
          <View style={styles.deadlineIconBox}>
            <Ionicons
              name={isPast(dl.date) ? "checkmark-circle-outline" : "alert-circle-outline"}
              size={20}
              color={isPast(dl.date) ? colors.success : colors.primary}
            />
          </View>
          <View style={styles.deadlineContent}>
            <Text style={styles.deadlineLabel}>{dl.label}</Text>
            <Text style={styles.deadlineDate}>
              {format(new Date(dl.date), "d MMMM yyyy", { locale: fr })}
            </Text>
            <View style={styles.quarterBadge}>
              <Text style={styles.quarterText}>{dl.quarter}</Text>
            </View>
          </View>
          {!isPast(dl.date) && isSoon(dl.date) && (
            <View style={styles.soonBadge}>
              <Text style={styles.soonText}>Bientôt</Text>
            </View>
          )}
        </View>
      ))}

      <View style={styles.infoNote}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.infoText}>
          Les dates URSSAF sont indicatives. Vérifiez sur urssaf.fr pour confirmer les échéances exactes.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Mes rappels</Text>

      {!reminders || reminders.length === 0 ? (
        <Text style={styles.emptyText}>Aucun rappel configuré</Text>
      ) : (
        reminders.map((reminder) => (
          <View key={reminder.id} style={styles.reminderCard}>
            <View style={styles.deadlineIconBox}>
              <Ionicons name="notifications-outline" size={20} color={colors.warning} />
            </View>
            <View style={styles.reminderContent}>
              <Text style={styles.reminderTitle}>{reminder.title}</Text>
              {reminder.description && (
                <Text style={styles.reminderDesc}>{reminder.description}</Text>
              )}
              {(reminder.dueDate || reminder.date) && (
                <Text style={styles.reminderDate}>
                  {format(
                    new Date(reminder.dueDate || reminder.date || ""),
                    "d MMMM yyyy",
                    { locale: fr }
                  )}
                </Text>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
