import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { newId } from './id';

export interface PickedContract { name: string; uri: string; size: number | null; }

/**
 * Pick a PDF and copy it into the app's own documents folder, so the link survives the
 * original being moved or deleted. Returns null if the user cancels.
 */
export async function pickContractPdf(): Promise<PickedContract | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  const dir = new Directory(Paths.document, 'contracts');
  dir.create({ idempotent: true, intermediates: true });
  const dest = new File(dir, `${newId()}.pdf`);
  new File(asset.uri).copy(dest);
  return { name: asset.name, uri: dest.uri, size: asset.size ?? null };
}

/** Hand the stored PDF to the phone's PDF apps. */
export async function openContract(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('No app available to open PDFs on this device');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Open contract' });
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return 'PDF';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
