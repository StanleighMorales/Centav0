import React, { useState, useEffect } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { AppTextInput } from '../ui/AppTextInput';
import { Button } from '../ui/Button';
import { AppText } from '../ui/AppText';
import { IconPicker } from './IconPicker';
import { ColorPicker } from './ColorPicker';
import { categoryRepo } from '../../repositories';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../../constants/categoryColors';
import { theme } from '../../theme';
import type { Category, CategoryType } from '../../domain/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initial?: Category;
  defaultType?: CategoryType;
};

export function CategorySheet({ visible, onClose, onSuccess, initial, defaultType = 'Expense' }: Props) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>(defaultType);
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setType(initial?.type ?? defaultType);
      setIcon(initial?.icon ?? CATEGORY_ICONS[0]);
      setColor(initial?.color ?? CATEGORY_COLORS[0]);
      setErrors({});
    }
  }, [visible]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Enter a category name';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      if (isEdit && initial) {
        await categoryRepo.update(initial.id, {
          name: name.trim(),
          icon: icon ?? undefined,
          color: color ?? undefined,
        });
      } else {
        await categoryRepo.create({
          name: name.trim(),
          type,
          icon: icon ?? undefined,
          color: color ?? undefined,
        });
      }
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={isEdit ? 'Edit Category' : 'Add Category'}>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppTextInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Groceries"
          error={errors.name}
        />
        {!isEdit && (
          <View>
            <AppText variant="labelLg" color="textSecondary" style={styles.typeLabel}>Type</AppText>
            <View style={styles.typeRow}>
              {(['Expense', 'Income'] as CategoryType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  accessibilityRole="button"
                  accessibilityLabel={t}
                  style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                >
                  <AppText variant="labelLg" color={type === t ? 'bgPrimary' : 'textSecondary'}>
                    {t}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        <IconPicker value={icon} onChange={setIcon} />
        <ColorPicker value={color} onChange={setColor} />
        <Button label={isEdit ? 'Save Changes' : 'Add Category'} onPress={handleSave} loading={saving} />
        <View style={styles.bottomPad} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing[5] },
  typeLabel: { marginBottom: theme.spacing[3] },
  typeRow: { flexDirection: 'row', gap: theme.spacing[3] },
  typeBtn: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    alignItems: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  typeBtnActive: {
    backgroundColor: theme.colors.accentPrimary,
    borderColor: theme.colors.accentPrimary,
  },
  bottomPad: { height: theme.spacing[5] },
});
