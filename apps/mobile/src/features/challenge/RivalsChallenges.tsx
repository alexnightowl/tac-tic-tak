import type { ChallengeSummary } from "@tac/core/storm";
import { eos, space } from "@tac/core/tokens";
import { router, type Href } from "expo-router";
import { Swords } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { displayNameOf } from "@/features/social/actions";
import { SwipeRow } from "@/features/social/SwipeRow";
import { CardRow, IconTile, SectionLabel, TextLink } from "@/ui";
import { useT, type TFn } from "@/ui/lang";
import { useChallengeList } from "./api";
import { OutcomeChip, PresenceAvatar } from "./parts";
import {
  challengeRemoveLabel,
  challengeRowText,
  FINISHED_FIRST,
  removeChallenge,
  type ChallengeRowKind,
} from "./rowModel";

/**
 * Rivals' "Challenges" section (app-only; STORM.md "Where challenges
 * show"): incoming first, then sent ones still waiting, then the last
 * finished / declined / expired with W/L/D. With none at all it is one
 * compact "Challenge a friend" row. Hidden until the list has loaded.
 * Swipe a row left to take it off the list (owner, 2026-11-04): an
 * incoming one is declined and a waiting one of mine withdrawn, each after
 * a confirm sheet; a finished one just goes.
 */
export function RivalsChallenges() {
  const t = useT();
  const q = useChallengeList();
  const [more, setMore] = useState(false);
  const d = q.data;
  if (!d) return null;
  const empty = d.incoming.length + d.outgoing.length + d.finished.length === 0;
  const finished = more ? d.finished : d.finished.slice(0, FINISHED_FIRST);
  return (
    <View style={styles.root} testID="rivals-challenges">
      <View style={styles.head}>
        <SectionLabel size="section">{t("challenge.section")}</SectionLabel>
        {!empty ? (
          <TextLink
            testID="rivals-challenge-new"
            label={t("challenge.cta")}
            onPress={() => router.push("/challenge/new" as Href)}
          />
        ) : null}
      </View>
      {empty ? (
        <CardRow
          testID="rivals-challenge-cta"
          title={t("challenge.cta")}
          subtitle={t("challenge.cta_hint")}
          elevated={false}
          leading={
            <IconTile size={36}>
              <Swords size={18} strokeWidth={1.8} color={eos.bone} />
            </IconTile>
          }
          onPress={() => router.push("/challenge/new" as Href)}
        />
      ) : null}
      {d.incoming.map((c) => (
        <Row key={c.id} c={c} t={t} kind="incoming" />
      ))}
      {d.outgoing.map((c) => (
        <Row key={c.id} c={c} t={t} kind="outgoing" />
      ))}
      {finished.map((c) => (
        <Row key={c.id} c={c} t={t} kind="finished" />
      ))}
      {!more && d.finished.length > FINISHED_FIRST ? (
        <View style={styles.more}>
          <TextLink
            testID="rivals-challenges-more"
            label={t("challenge.more", {
              n: d.finished.length - FINISHED_FIRST,
            })}
            onPress={() => setMore(true)}
          />
        </View>
      ) : null}
    </View>
  );
}

function Row({
  c,
  t,
  kind,
}: {
  c: ChallengeSummary;
  t: TFn;
  kind: ChallengeRowKind;
}) {
  const name = displayNameOf(c.other);
  const { subtitle, chip } = challengeRowText(c, kind, t);
  const remove = () => removeChallenge(c, kind, t);
  const swipeLabel = challengeRemoveLabel(kind, t);
  return (
    <SwipeRow
      testID={`rivals-challenge-swipe-${c.id}`}
      declineLabel={swipeLabel}
      onDecline={remove}
    >
      <CardRow
        testID={`rivals-challenge-${c.id}`}
        title={name}
        subtitle={subtitle}
        elevated={false}
        accessibilityLabel={`${name}, ${subtitle}`}
        leading={
          <PresenceAvatar
            nickname={c.other.nickname}
            avatarUrl={c.other.avatarUrl}
            size={36}
          />
        }
        trailing={
          chip ? <OutcomeChip label={chip.label} kind={chip.kind} /> : null
        }
        onPress={() => router.push(`/challenge/${c.id}` as Href)}
      />
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[1.5] },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
  },
  more: { alignItems: "center", paddingTop: space[1] },
});
