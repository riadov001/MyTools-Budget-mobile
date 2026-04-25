import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Loader2, Eye } from "lucide-react";
import { apiRequest, getAuthToken, getActiveAppId } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AttachmentButtonProps {
  /** Endpoint à appeler pour lier le fichier (ex: `/api/expenses/12/attachment`). */
  linkEndpoint: string;
  /** Pièce jointe actuelle (chemin /objects/...) si déjà présente. */
  currentPath?: string | null;
  currentName?: string | null;
  /** Callback après succès — pour invalider les queries du parent. */
  onUploaded?: (objectPath: string, name: string) => void;
  /** Taille max en octets (défaut 10 Mo). */
  maxSize?: number;
  /** Variante / taille du bouton. */
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "outline" | "default" | "secondary";
  /** Libellé personnalisé. */
  label?: string;
}

/**
 * Bouton d'upload générique : presigned URL → PUT GCS → POST /attachment.
 * Tous les médias passent par DEFAULT_OBJECT_STORAGE_ID.
 */
export function AttachmentButton({
  linkEndpoint,
  currentPath,
  currentName,
  onUploaded,
  maxSize = 10 * 1024 * 1024,
  size = "sm",
  variant = "outline",
  label,
}: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const handlePick = () => inputRef.current?.click();

  const handleView = async () => {
    if (!currentPath) return;
    setBusy(true);
    try {
      const headers: Record<string, string> = {};
      const token = getAuthToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const aid = getActiveAppId();
      if (aid && aid !== "0") headers["X-App-Id"] = aid;
      const r = await fetch(currentPath, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Lecture impossible", description: err?.message || "Erreur" });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > maxSize) {
      toast({ variant: "destructive", title: "Fichier trop volumineux", description: `Max ${(maxSize / 1024 / 1024).toFixed(0)} Mo` });
      return;
    }
    setBusy(true);
    try {
      const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      });
      if (!urlRes.ok) throw new Error("URL d'upload introuvable");
      const { uploadURL, objectPath } = await urlRes.json();
      const put = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!put.ok) throw new Error("Échec de l'upload");
      const link = await apiRequest("POST", linkEndpoint, { objectPath, attachmentName: file.name });
      if (!link.ok) throw new Error("Liaison du fichier impossible");
      toast({ title: "Pièce jointe ajoutée", description: file.name });
      onUploaded?.(objectPath, file.name);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur upload", description: err?.message || "Erreur inconnue" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
      {currentPath ? (
        <button
          type="button"
          onClick={handleView}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline truncate max-w-[180px] disabled:opacity-50"
          title={currentName || currentPath}
          data-testid="link-view-attachment"
        >
          <Eye className="h-3 w-3" />
          <span className="truncate">{currentName || "pièce jointe"}</span>
        </button>
      ) : null}
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={handlePick}
        disabled={busy}
        data-testid="button-attach"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
        {size !== "icon" && <span className="ml-1">{label ?? (currentPath ? "Remplacer" : "Joindre")}</span>}
      </Button>
    </div>
  );
}
