import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { newId } from './id';
import { parseReceipt, type ParsedReceipt } from './receipt';

export interface ScanResult { uri: string; parsed: ParsedReceipt; }

/** Camera or gallery. Returns null if the user cancels or denies permission. */
export async function pickReceiptImage(source: 'camera' | 'gallery'): Promise<string | null> {
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(opts)
    : await ImagePicker.launchImageLibraryAsync(opts);
  return result.canceled ? null : result.assets[0].uri;
}

/** Copy into app storage so the link survives the picker's cache being cleared. */
function keepReceipt(srcUri: string): string {
  const dir = new Directory(Paths.document, 'receipts');
  dir.create({ idempotent: true, intermediates: true });
  const dest = new File(dir, `${newId()}.jpg`);
  new File(srcUri).copy(dest);
  return dest.uri;
}

/** Pick, store and OCR a receipt. OCR failure still returns the stored photo with empty fields. */
export async function scanReceipt(source: 'camera' | 'gallery'): Promise<ScanResult | null> {
  const picked = await pickReceiptImage(source);
  if (!picked) return null;
  const uri = keepReceipt(picked);
  try {
    // Lazy: the package throws on import when the installed dev build predates the native module.
    const { extractTextFromImage, isSupported } = require('expo-text-extractor') as typeof import('expo-text-extractor');
    const lines = isSupported ? await extractTextFromImage(uri) : [];
    return { uri, parsed: parseReceipt(lines) };
  } catch {
    return { uri, parsed: parseReceipt([]) };
  }
}
