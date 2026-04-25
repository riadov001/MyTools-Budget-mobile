import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
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

const CATEGORIES = [
  "Tous",
  "Transport",
  "Repas",
  "Matériel",
  "Logiciels",
  "Formation",
  "Autre",
];

export default function BudgetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [showModal, setShowModal] = useState(false);

  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("Autre");
  const [newDate, setNewDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newRecurrenceKey, setNewRecurrenceKey] = useState("monthly:1");

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await apiClient.get<Expense[] | { expenses: Expense[] }>("/api/expenses");
      return Array.isArray(res.data) ? res.data : (res.data as { expenses: Expense[] }).expenses || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: () => {
      Alert.alert("Erreur", "Impossible de supprimer la dépense. Réessayez.");
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiClient.post("/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setShowModal(false);
      setNewDesc("");
      setNewAmount("");
      setNewCategory("Autre");
      setNewDate(format(new Date(), "yyyy-MM-dd"));
      setNewIsRecurring(false);
      setNewRecurrenceKey("monthly:1");
    },
    onError: () => {
      Alert.alert("Erreur", "Impossible d'ajouter la dépense. Réessayez.");
    },
  });

  const RECURRENCE_OPTIONS_M: Array<{ value: string; label: string }> = [
    { value: "weekly:1",  label: "Chaque semaine" },
    { value: "monthly:1", label: "Chaque mois" },
    { value: "monthly:3", label: "Tous les 3 mois" },
    { value: "monthly:6", label: "Tous les 6 mois" },
    { value: "yearly:1",  label: "Chaque année" },
  ];

  const computeNext = (from: Date, key: string): Date => {
    const [freq, intStr] = key.split(":");
    const i = Math.max(1, parseInt(intStr, 10) || 1);
    const d = new Date(from);
    if (freq === "weekly")  d.setDate(d.getDate() + 7 * i);
    else if (freq === "monthly") d.setMonth(d.getMonth() + i);
    else if (freq === "yearly")  d.setFullYear(d.getFullYear() + i);
    else d.setDate(d.getDate() + i);
    return d;
  };

  const handleDelete = (expense: Expense) => {
    Alert.alert(
      "Supprimer la dépense",
      `Voulez-vous supprimer "${expense.description}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => deleteMutation.mutate(expense.id),
        },
      ]
    );
  };

  const handleAdd = () => {
    if (!newDesc.trim()) {
      Alert.alert("Erreur", "La description est requise.");
      return;
    }
    const amount = parseFloat(newAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Erreur", "Veuillez saisir un montant valide.");
      return;
    }
    const baseDate = new Date(newDate);
    const [freq, intStr] = newRecurrenceKey.split(":");
    const interval = Math.max(1, parseInt(intStr, 10) || 1);
    addMutation.mutate({
      description: newDesc.trim(),
      amount: amount.toFixed(2),
      total: amount.toFixed(2),
      taxAmount: "0",
      category: newCategory,
      date: baseDate.toISOString(),
      isRecurring: newIsRecurring,
      recurrenceFrequency: newIsRecurring ? freq : null,
      recurrenceInterval: newIsRecurring ? interval : 1,
      recurrenceEndDate: null,
      nextOccurrenceDate: newIsRecurring
        ? computeNext(baseDate, newRecurrenceKey).toISOString()
        : null,
    });
  };

  const filteredExpenses =
    selectedCategory === "Tous"
      ? expenses || []
      : (expenses || []).filter(
          (e) =>
            e.category?.toLowerCase() === selectedCategory.toLowerCase()
        );

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingTop: Math.max(insets.top, Platform.OS === "web" ? 67 : 0) + 16,
      paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 34 : 0) + 100,
      paddingHorizontal: 20,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
      marginBottom: 4,
    },
    totalAmount: {
      fontSize: 36,
      fontFamily: "Exo2_700Bold",
      color: colors.primary,
      marginTop: 4,
    },
    totalLabel: {
      fontSize: 12,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
    },
    filterRow: {
      marginBottom: 20,
    },
    filterPill: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
    },
    filterPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterPillText: {
      fontSize: 13,
      fontFamily: "Exo2_500Medium",
      color: colors.textSecondary,
    },
    filterPillTextActive: {
      color: "#FFFFFF",
    },
    expenseCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    expenseIconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.primary + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    expenseContent: {
      flex: 1,
    },
    expenseTitle: {
      fontSize: 14,
      fontFamily: "Exo2_500Medium",
      color: colors.foreground,
    },
    expenseMeta: {
      fontSize: 11,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
      marginTop: 3,
    },
    expenseAmount: {
      fontSize: 16,
      fontFamily: "Exo2_700Bold",
      color: colors.primary,
    },
    deleteBtn: {
      padding: 8,
    },
    emptyContainer: {
      alignItems: "center",
      paddingTop: 48,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 12,
    },
    fab: {
      position: "absolute",
      right: 20,
      bottom: Math.max(insets.bottom, Platform.OS === "web" ? 34 : 0) + 90,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: Math.max(insets.bottom + 24, 40),
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: "Exo2_700Bold",
      color: colors.foreground,
      marginBottom: 20,
    },
    modalLabel: {
      fontSize: 13,
      fontFamily: "Exo2_500Medium",
      color: colors.textSecondary,
      marginBottom: 6,
    },
    modalInput: {
      backgroundColor: colors.elevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      height: 48,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: "Exo2_400Regular",
      color: colors.foreground,
      marginBottom: 14,
    },
    categoryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    catPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    catPillText: {
      fontSize: 12,
      fontFamily: "Exo2_500Medium",
      color: colors.textSecondary,
    },
    catPillTextActive: {
      color: "#FFFFFF",
    },
    recurrenceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    recurrenceHint: {
      fontSize: 11,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
      marginTop: 2,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    submitBtnText: {
      fontSize: 16,
      fontFamily: "Exo2_600SemiBold",
      color: "#FFFFFF",
    },
    cancelBtn: {
      alignItems: "center",
      padding: 12,
      marginTop: 4,
    },
    cancelBtnText: {
      fontSize: 14,
      fontFamily: "Exo2_500Medium",
      color: colors.textMuted,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Budget</Text>
          <Text style={styles.totalLabel}>Total dépenses</Text>
          <Text style={styles.totalAmount}>
            {totalFiltered.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              style={[styles.filterPill, selectedCategory === cat && styles.filterPillActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedCategory === cat && styles.filterPillTextActive,
                ]}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ paddingTop: 40 }} />
        ) : filteredExpenses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Aucune dépense pour cette catégorie</Text>
          </View>
        ) : (
          filteredExpenses.map((expense) => (
            <View key={expense.id} style={styles.expenseCard}>
              <View style={styles.expenseIconBox}>
                <Ionicons name="receipt-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.expenseContent}>
                <Text style={styles.expenseTitle} numberOfLines={1}>
                  {expense.description}
                </Text>
                <Text style={styles.expenseMeta}>
                  {expense.category || "Autre"} ·{" "}
                  {expense.date
                    ? format(new Date(expense.date), "d MMM yyyy", { locale: fr })
                    : expense.createdAt
                    ? format(new Date(expense.createdAt), "d MMM yyyy", { locale: fr })
                    : ""}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>
                -{expense.amount.toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                })}
              </Text>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => handleDelete(expense)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setShowModal(true)}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowModal(false)}
        >
          <Pressable onPress={() => {}}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Ajouter une dépense</Text>

              <Text style={styles.modalLabel}>Description *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex : Achat logiciel Adobe..."
                placeholderTextColor={colors.textMuted}
                value={newDesc}
                onChangeText={setNewDesc}
                autoCapitalize="sentences"
              />

              <Text style={styles.modalLabel}>Montant (€) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0,00"
                placeholderTextColor={colors.textMuted}
                value={newAmount}
                onChangeText={setNewAmount}
                keyboardType="decimal-pad"
              />

              <Text style={styles.modalLabel}>Catégorie</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.filter((c) => c !== "Tous").map((cat) => (
                  <Pressable
                    key={cat}
                    style={[styles.catPill, newCategory === cat && styles.catPillActive]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.catPillText,
                        newCategory === cat && styles.catPillTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.modalLabel}>Date</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={newDate}
                onChangeText={setNewDate}
                keyboardType="numbers-and-punctuation"
              />

              {/* ─── Récurrence ─────────────────────────────────────────── */}
              <View style={styles.recurrenceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalLabel}>Dépense récurrente</Text>
                  <Text style={styles.recurrenceHint}>
                    Génère automatiquement les prochaines occurrences
                  </Text>
                </View>
                <Switch
                  value={newIsRecurring}
                  onValueChange={setNewIsRecurring}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {newIsRecurring && (
                <>
                  <Text style={styles.modalLabel}>Fréquence</Text>
                  <View style={styles.categoryRow}>
                    {RECURRENCE_OPTIONS_M.map((o) => (
                      <Pressable
                        key={o.value}
                        style={[
                          styles.catPill,
                          newRecurrenceKey === o.value && styles.catPillActive,
                        ]}
                        onPress={() => setNewRecurrenceKey(o.value)}
                      >
                        <Text
                          style={[
                            styles.catPillText,
                            newRecurrenceKey === o.value && styles.catPillTextActive,
                          ]}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <Pressable
                style={styles.submitBtn}
                onPress={handleAdd}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Ajouter la dépense</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
