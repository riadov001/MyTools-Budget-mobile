import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import apiClient from "@/src/api/client";

interface OcrResult {
  filename: string;
  category?: string;
  vendor?: string;
  date?: string;
  amount?: number;
  error?: string;
}

interface PickedImage {
  uri: string;
  name: string;
}

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [images, setImages] = useState<PickedImage[]>([]);
  const [results, setResults] = useState<OcrResult[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const requestCameraPermission = async () => {
    if (Platform.OS === "web") return true;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission refusée",
        "Autorisez Budget by MyTools à accéder à la caméra dans les paramètres."
      );
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async () => {
    if (Platform.OS === "web") return true;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission refusée",
        "Autorisez Budget by MyTools à accéder à la galerie dans les paramètres."
      );
      return false;
    }
    return true;
  };

  const handleCamera = async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      setImages((prev) => [...prev, { uri: asset.uri, name }].slice(0, 10));
      setResults(null);
    }
  };

  const handleGallery = async () => {
    const ok = await requestGalleryPermission();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled && result.assets.length > 0) {
      const picked = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName || `image_${Date.now()}.jpg`,
      }));
      setImages((prev) => [...prev, ...picked].slice(0, 10));
      setResults(null);
    }
  };

  const handleAnalyze = async () => {
    if (!images.length) return;
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      for (const img of images) {
        if (Platform.OS === "web") {
          const response = await fetch(img.uri);
          const blob = await response.blob();
          formData.append("files", blob, img.name);
        } else {
          formData.append("files", {
            uri: img.uri,
            name: img.name,
            type: "image/jpeg",
          } as unknown as Blob);
        }
      }
      const res = await apiClient.post<{ results: OcrResult[] } | OcrResult[]>(
        "/api/ocr/batch",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const ocrResults = Array.isArray(res.data)
        ? res.data
        : (res.data as { results: OcrResult[] }).results || [];
      setResults(ocrResults);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      Alert.alert(
        "Erreur OCR",
        axiosError?.response?.data?.message ||
          "Impossible d'analyser les documents. Veuillez réessayer."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setImages([]);
    setResults(null);
  };

  const getCategoryColor = (category?: string, colors2?: ReturnType<typeof useColors>) => {
    const c = colors2 || colors;
    switch (category?.toLowerCase()) {
      case "invoice":
      case "facture":
        return c.warning;
      case "expense":
      case "depense":
        return c.primary;
      case "receipt":
      case "recu":
        return c.success;
      default:
        return c.textSecondary;
    }
  };

  const getCategoryLabel = (category?: string) => {
    switch (category?.toLowerCase()) {
      case "invoice":
        return "Facture";
      case "expense":
        return "Dépense";
      case "receipt":
        return "Reçu";
      default:
        return category || "Autre";
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
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: "Exo2_400Regular",
      color: colors.textSecondary,
      marginBottom: 24,
    },
    actionRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 20,
    },
    actionButton: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      alignItems: "center",
      gap: 8,
    },
    actionButtonText: {
      fontSize: 14,
      fontFamily: "Exo2_600SemiBold",
      color: colors.foreground,
    },
    thumbnailsContainer: {
      marginBottom: 20,
    },
    thumbnailsTitle: {
      fontSize: 13,
      fontFamily: "Exo2_600SemiBold",
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    thumbnailsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    thumbnail: {
      width: 72,
      height: 72,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    analyzeButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    analyzeButtonDisabled: {
      opacity: 0.4,
    },
    analyzeButtonText: {
      fontSize: 16,
      fontFamily: "Exo2_600SemiBold",
      color: "#FFFFFF",
    },
    resetButton: {
      alignItems: "center",
      padding: 8,
      marginBottom: 20,
    },
    resetText: {
      fontSize: 14,
      fontFamily: "Exo2_500Medium",
      color: colors.textMuted,
    },
    resultsTitle: {
      fontSize: 13,
      fontFamily: "Exo2_600SemiBold",
      color: colors.textMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    resultCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    resultFilename: {
      fontSize: 13,
      fontFamily: "Exo2_500Medium",
      color: colors.textSecondary,
      flex: 1,
      marginRight: 8,
    },
    categoryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    categoryText: {
      fontSize: 12,
      fontFamily: "Exo2_600SemiBold",
    },
    resultRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    resultLabel: {
      fontSize: 12,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
    },
    resultValue: {
      fontSize: 13,
      fontFamily: "Exo2_500Medium",
      color: colors.foreground,
    },
    errorCard: {
      backgroundColor: colors.primary + "15",
      borderColor: colors.primary + "40",
    },
    errorText: {
      fontSize: 13,
      fontFamily: "Exo2_400Regular",
      color: colors.primary,
    },
    emptyContainer: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Exo2_400Regular",
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 16,
      lineHeight: 21,
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Scanner</Text>
      <Text style={styles.subtitle}>
        Analysez vos documents par OCR (jusqu'à 10 fichiers)
      </Text>

      <View style={styles.actionRow}>
        <Pressable style={styles.actionButton} onPress={handleCamera}>
          <Ionicons name="camera-outline" size={28} color={colors.primary} />
          <Text style={styles.actionButtonText}>Caméra</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={handleGallery}>
          <Ionicons name="images-outline" size={28} color={colors.primary} />
          <Text style={styles.actionButtonText}>Galerie</Text>
        </Pressable>
      </View>

      {images.length > 0 && (
        <View style={styles.thumbnailsContainer}>
          <Text style={styles.thumbnailsTitle}>
            {images.length} fichier{images.length > 1 ? "s" : ""} sélectionné{images.length > 1 ? "s" : ""}
          </Text>
          <View style={styles.thumbnailsRow}>
            {images.map((img, idx) => (
              <Image key={idx} source={{ uri: img.uri }} style={styles.thumbnail} />
            ))}
          </View>
        </View>
      )}

      {images.length > 0 && !results && (
        <Pressable
          style={[styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]}
          onPress={handleAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.analyzeButtonText}>Analyser par OCR</Text>
          )}
        </Pressable>
      )}

      {results && (
        <>
          <Text style={styles.resultsTitle}>Résultats</Text>
          {results.map((result, idx) => (
            <View
              key={idx}
              style={[styles.resultCard, result.error && styles.errorCard]}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultFilename} numberOfLines={1}>
                  {result.filename}
                </Text>
                {!result.error && (
                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: getCategoryColor(result.category) + "22" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        { color: getCategoryColor(result.category) },
                      ]}
                    >
                      {getCategoryLabel(result.category)}
                    </Text>
                  </View>
                )}
              </View>
              {result.error ? (
                <Text style={styles.errorText}>
                  Erreur : {result.error}
                </Text>
              ) : (
                <>
                  {result.vendor && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Fournisseur</Text>
                      <Text style={styles.resultValue}>{result.vendor}</Text>
                    </View>
                  )}
                  {result.date && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Date</Text>
                      <Text style={styles.resultValue}>{result.date}</Text>
                    </View>
                  )}
                  {result.amount !== undefined && (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Montant</Text>
                      <Text style={[styles.resultValue, { fontFamily: "Exo2_700Bold" }]}>
                        {result.amount.toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          ))}
          <Pressable style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetText}>Recommencer</Text>
          </Pressable>
        </>
      )}

      {images.length === 0 && !results && (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            Sélectionnez des images avec la caméra ou depuis votre galerie pour
            les analyser par reconnaissance optique de caractères.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
