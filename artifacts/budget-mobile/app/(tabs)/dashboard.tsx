import React from "react";
import {
  ActivityIndicator,
  Platform,
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

interface Expense {
  id: string;
  description: string;
  amount: number;
  category?: string;
  date?: string;
  createdAt?: string;
}

interface Invoice {
  id: string;
  description?: string;
  amount: number;
  status?: string;
  date?: string;
  createdAt?: string;
}

function SkeletonCard({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View
      style={{
        width: 160,
        height: 100,
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: 12,
        padding: 16,
        justifyContent: "space-between",
      }}
    >
      <View style={{ width: 80, height: 12, backgroundColor: colors.elevated, borderRadius: 6 }} />
      <View style={{ width: 100, height: 24, backgroundColor: colors.elevated, borderRadius: 6 }} />
    </View>
  );
}

function StatusBadge({ status, colors }: { status?: string; colors: ReturnType<typeof useColors> }) {
  const isPaid = status === "paid";
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: isPaid ? colors.success + "22" : colors.warning + "22",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: "Exo2_600SemiBold",
          color: isPaid ? colors.success : colors.warning,
        }}
      >
        {isPaid ? "Payé" : "En attente"}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await apiClient.get<Expense[] | { expenses: Expense[] }>("/api/expenses");
      return Array.isArray(res.data) ? res.data : (res.data as { expenses: Expense[] }).expenses || [];
    },
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await apiClient.get<Invoice[] | { invoices: Invoice[] }>("/api/invoices");
      return Array.isArray(res.data) ? res.data : (res.data as { invoices: Invoice[] }).invoices || [];
    },
  });

  const totalExpenses = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalInvoiced = (invoices || []).reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPaid = (invoices || [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.amount || 0), 0);
  const pending = totalInvoiced - totalPaid;

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "vous";

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Bonjour"
      : greetingHour < 18
      ? "Bon après-midi"
      : "Bonsoir";

  const stats = [
    { label: "Total Dépenses", amount: totalExpenses, icon: "trending-down-outline" as const, color: colors.primary },
    { label: "Total Facturé", amount: totalInvoiced, icon: "document-text-outline" as const, color: colors.warning },
    { label: "Encaissé", amount: totalPaid, icon: "checkmark-circle-outline" as const, color: colors.success },
    { label: "En attente", amount: pending, icon: "time-outline" as const, color: colors.textSecondary },
  ];

  const isLoading = expensesLoading || invoicesLoading;

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
    greeting: {
      fontSize: 13,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      marginBottom: 4,
    },
    greetingName: {
      fontSize: 24,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: "Exo2_600SemiBold",
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    statsScroll: {
      marginBottom: 28,
    },
    statCard: {
      width: 160,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 12,
      padding: 16,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: "Exo2_500Medium",
      color: colors.textMuted,
      marginTop: 8,
    },
    statAmount: {
      fontSize: 20,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
      marginTop: 4,
    },
    listCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 28,
      overflow: "hidden",
    },
    listItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    listItemLast: {
      borderBottomWidth: 0,
    },
    listItemLeft: {
      flex: 1,
      marginRight: 12,
    },
    listItemTitle: {
      fontSize: 14,
      fontFamily: "Exo2_500Medium",
      color: colors.foreground,
    },
    listItemSub: {
      fontSize: 11,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
      marginTop: 2,
    },
    listItemAmount: {
      fontSize: 15,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
      textAlign: "center",
      padding: 20,
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.greeting}>{greeting},</Text>
      <Text style={styles.greetingName}>{firstName} 👋</Text>

      <Text style={styles.sectionTitle}>Vue d'ensemble</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={{ paddingRight: 20 }}
      >
        {isLoading
          ? [0, 1, 2, 3].map((i) => <SkeletonCard key={i} colors={colors} />)
          : stats.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Ionicons name={stat.icon} size={22} color={stat.color} />
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statAmount}>
                  {stat.amount.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                  })}
                </Text>
              </View>
            ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Dernières dépenses</Text>
      <View style={styles.listCard}>
        {expensesLoading ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
        ) : !expenses?.length ? (
          <Text style={styles.emptyText}>Aucune dépense enregistrée</Text>
        ) : (
          expenses.slice(0, 5).map((expense, idx) => (
            <View
              key={expense.id}
              style={[
                styles.listItem,
                idx === Math.min(expenses.length, 5) - 1 && styles.listItemLast,
              ]}
            >
              <View style={styles.listItemLeft}>
                <Text style={styles.listItemTitle} numberOfLines={1}>
                  {expense.description || "Dépense"}
                </Text>
                <Text style={styles.listItemSub}>
                  {expense.category || "Autre"} ·{" "}
                  {expense.date
                    ? format(new Date(expense.date), "d MMM", { locale: fr })
                    : expense.createdAt
                    ? format(new Date(expense.createdAt), "d MMM", { locale: fr })
                    : ""}
                </Text>
              </View>
              <Text style={[styles.listItemAmount, { color: colors.primary }]}>
                -{expense.amount.toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                })}
              </Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>Dernières factures</Text>
      <View style={styles.listCard}>
        {invoicesLoading ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
        ) : !invoices?.length ? (
          <Text style={styles.emptyText}>Aucune facture enregistrée</Text>
        ) : (
          invoices.slice(0, 5).map((invoice, idx) => (
            <View
              key={invoice.id}
              style={[
                styles.listItem,
                idx === Math.min(invoices.length, 5) - 1 && styles.listItemLast,
              ]}
            >
              <View style={styles.listItemLeft}>
                <Text style={styles.listItemTitle} numberOfLines={1}>
                  {invoice.description || "Facture"}
                </Text>
                <Text style={styles.listItemSub}>
                  {invoice.date
                    ? format(new Date(invoice.date), "d MMM yyyy", { locale: fr })
                    : invoice.createdAt
                    ? format(new Date(invoice.createdAt), "d MMM yyyy", { locale: fr })
                    : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={styles.listItemAmount}>
                  {invoice.amount.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </Text>
                <StatusBadge status={invoice.status} colors={colors} />
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

