import { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppText, Button } from '../../src/components/ui';
import { setSetting } from '../../src/repositories/settings';
import { theme } from '../../src/theme';

type Slide = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
  steps?: string[];
};

const SLIDES: Slide[] = [
  {
    icon: 'book-open',
    title: 'What is Centav0?',
    body: 'A private money tracker. Record what you earn and spend across your accounts, set budgets, and watch your balances update — all stored on your device, no sign-up.',
  },
  {
    icon: 'credit-card',
    title: 'Start with an account',
    body: 'Accounts hold your money — Cash, a Bank, or an e-wallet like GCash. Every transaction draws from one account.',
    steps: [
      'Open More ▸ Accounts',
      'Tap + and give it a name',
      'Set its starting balance',
    ],
  },
  {
    icon: 'sliders',
    title: 'Account types',
    body: 'Types group your accounts and decide which ones count as spendable. Mark a type as Savings and its balance stays out of the “available funds” your debts are measured against — so money you’re setting aside is never counted as money you can spend.',
    steps: [
      'Open More ▸ Account Types',
      'Tap + to add your own type',
      'Flag it as Savings to ring-fence it',
    ],
  },
  {
    icon: 'arrow-down-circle',
    title: 'Add income',
    body: 'Money coming in raises an account’s balance.',
    steps: [
      'Tap + on the dashboard',
      'Choose Income',
      'Enter the amount',
      'Pick the account it goes into',
      'Pick a category, then Save',
    ],
  },
  {
    icon: 'arrow-up-circle',
    title: 'Add an expense',
    body: 'Money going out lowers the account’s balance.',
    steps: [
      'Tap + ▸ Expense',
      'Enter the amount',
      'Pick the account it came from',
      'Pick a category',
      'Attach a receipt photo (optional), then Save',
    ],
  },
  {
    icon: 'repeat',
    title: 'Move money between accounts',
    body: 'Moving cash into your bank isn’t income or an expense — it’s a transfer. One account drops, the other rises, and your total balance stays exactly the same.',
    steps: [
      'Tap the ⇄ button beside ACCOUNTS on the dashboard',
      'Pick the account it leaves and the one it lands in',
      'Enter the amount, then Save',
    ],
  },
  {
    icon: 'tag',
    title: 'Categories',
    body: 'Categories label each transaction — Salary, Food, Transport, Bills. Income and expense keep separate sets.',
    steps: [
      'Manage them in More ▸ Categories',
      'Or tap + beside Category while adding a transaction to make one on the spot',
    ],
  },
  {
    icon: 'pie-chart',
    title: 'Budgets',
    body: 'Cap your spending per category so you never overspend.',
    steps: [
      'Open More ▸ Budgets ▸ +',
      'Pick an expense category and a limit',
      'As you log expenses, the bar fills gold → amber → red as you near the cap',
    ],
  },
  {
    icon: 'trending-down',
    title: 'Debts',
    body: 'Track money you owe across three kinds: Credit for cards and credit lines, Loan for borrowed cash, and Custom for anything else. Borrowing can pay straight into an account, so the cash shows up where it actually landed.',
    steps: [
      'Tap + on the Debts tab',
      'Name the creditor and the amount owed',
      'Choose which account receives the money',
      'Log each payment as you pay it down',
    ],
  },
  {
    icon: 'calendar',
    title: 'Installment plans',
    body: 'Paying something off monthly? Turn on Installment plan and Centav0 builds the whole payment schedule for you — every month of the term, with interest and any one-time fee folded in.',
    steps: [
      'Switch on Installment plan when adding the debt',
      'Enter the Monthly Payment and Term (months)',
      'Add Monthly Interest and Other Fees if they apply',
      'The due date sets when month one falls — it’s required here',
    ],
  },
  {
    icon: 'grid',
    title: 'Three ways to see what’s due',
    body: 'The Debts tab switches between List, Monthly, and Grid. List is every debt at a glance. Monthly is one month at a time. Grid lays your installment loans out as rows against all twelve months, so a whole year of payments fits on one screen.',
    steps: [
      'Tap List, Monthly, or Grid at the top',
      'Swipe the Grid sideways to reach later months',
      'Tap any cell for that month’s principal and interest',
      'Set Expected Income and Still Needed tells you the shortfall',
    ],
  },
  {
    icon: 'users',
    title: 'Money you lent out',
    body: 'The Lent tab is the mirror of Debts — what other people owe you. Lendings are grouped by person, and the money leaves whichever account you lent it from, so your balances stay honest.',
    steps: [
      'Open the Lent tab and tap +',
      'Pick or add the person who borrowed',
      'Enter the amount and the account it came out of',
      'Log repayments until it flips to Paid',
    ],
  },
  {
    icon: 'bar-chart-2',
    title: 'Reports',
    body: 'See income against expense for any stretch of time, plus where the money actually went — every category ranked by total, with its share of your spending.',
    steps: [
      'Open More ▸ Reports',
      'Pick a preset period, or set your own From and To dates',
      'Read the category breakdown underneath',
    ],
  },
  {
    icon: 'tool',
    title: 'Handy extras',
    body: 'A calculator sits in the header of every screen — tap it beside the ⋮ menu whenever you need to work out a figure mid-entry. And nothing you delete is truly gone.',
    steps: [
      'Tap the calculator icon in the header, beside the ⋮ menu',
      'Deleted a transaction by mistake? More ▸ Transaction Archive',
      'Tap the eye on the dashboard to hide your balances',
    ],
  },
  {
    icon: 'check-circle',
    title: 'You’re all set',
    body: 'Tap + any time to record money in or out — your balances, budgets, and reports update instantly. You can replay this guide from More ▸ How to use Centav0. Let’s add your first account.',
  },
];

export default function TutorialScreen() {
  const router = useRouter();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  function finish() {
    setSetting('tutorial_seen', '1').catch(() => {});
    if (replay) {
      router.back();
      return;
    }
    router.replace('/onboarding/setup-account');
  }

  function next() {
    if (isLast) {
      finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.index;
    if (first != null) setIndex(first);
  }).current;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.skipRow}>
        <Pressable
          onPress={finish}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip tutorial"
        >
          <AppText variant="labelLg" color="textSecondary">Skip</AppText>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={SLIDES}
        keyExtractor={(s) => s.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <ScrollView
              contentContainerStyle={styles.slideScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.iconCircle}>
                <Feather name={item.icon} size={36} color={theme.colors.accentPrimary} />
              </View>
              <AppText variant="h1" color="textPrimary" style={styles.title}>
                {item.title}
              </AppText>
              <AppText variant="body" color="textSecondary" style={styles.body}>
                {item.body}
              </AppText>
              {item.steps ? (
                <View style={styles.steps}>
                  {item.steps.map((step, i) => (
                    <View key={step} style={styles.step}>
                      <View style={styles.stepNum}>
                        <AppText variant="labelSm" color="bgPrimary">{String(i + 1)}</AppText>
                      </View>
                      <AppText variant="body" color="textPrimary" style={styles.stepText}>
                        {step}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          label={isLast ? 'Get Started' : 'Next'}
          onPress={next}
          accessibilityLabel={isLast ? 'Get Started' : 'Next slide'}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing['5'],
    paddingTop: theme.spacing['3'],
  },
  list: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  slideScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing['7'],
    paddingVertical: theme.spacing['6'],
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentSubtle,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing['7'],
  },
  title: {
    textAlign: 'center',
    marginBottom: theme.spacing['4'],
  },
  body: {
    textAlign: 'center',
  },
  steps: {
    alignSelf: 'stretch',
    gap: theme.spacing['4'],
    marginTop: theme.spacing['7'],
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing['4'],
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepText: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing['2'],
    marginBottom: theme.spacing['6'],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.borderStrong,
  },
  dotActive: {
    width: 20,
    backgroundColor: theme.colors.accentPrimary,
  },
  footer: {
    paddingHorizontal: theme.spacing['6'],
    paddingBottom: theme.spacing['8'],
  },
});
