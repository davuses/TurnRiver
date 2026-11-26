import type { Card, Position, Street } from './types';
import type { TableActionLogItem, TablePhase } from './tableEngine';
import {
  formatChips,
  formatSignedChips,
  getCashStakes,
  type ChipDisplayConfig,
} from './currency';

export interface ExportableReplaySeat {
  seatIndex: number;
  name: string;
  isHero: boolean;
  position: Position;
  stackBb: number;
  cards: [Card, Card] | null;
  folded: boolean;
}

export interface ExportableReplayFrame {
  phase: TablePhase;
  board: Card[];
  potBb: number;
  seats: ExportableReplaySeat[];
  buttonSeatIndex: number;
  winnerSummary: string | null;
}

export interface ExportableReplayRecord {
  handNumber: number;
  tableSize: number;
  heroCards: [Card, Card] | null;
  netBb: number;
  totalPotBb: number;
  frames: ExportableReplayFrame[];
  actionLog?: TableActionLogItem[];
}

function formatCardCode(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function formatCardsBracket(cards: Card[]): string {
  return `[${cards.map(formatCardCode).join(' ')}]`;
}

function formatStakesHeader(display?: ChipDisplayConfig): string {
  if (display?.unit === 'usd') {
    const stakes = getCashStakes(display.stakesId);
    const sbStr = stakes.sbUsd % 1 === 0 ? `$${stakes.sbUsd}` : `$${stakes.sbUsd.toFixed(2)}`;
    const bbStr = stakes.bbUsd % 1 === 0 ? `$${stakes.bbUsd}` : `$${stakes.bbUsd.toFixed(2)}`;
    return `(${sbStr}/${bbStr} USD)`;
  }
  return '(0.5bb/1bb)';
}

function formatActionLine(item: TableActionLogItem, display?: ChipDisplayConfig): string {
  const spec = item.actionSpec;
  const amt =
    spec?.amountBb !== undefined
      ? formatChips(spec.amountBb, display, { compact: display?.unit !== 'usd' })
      : '';

  if (!spec) {
    return `${item.seatName}: ${item.text}`;
  }

  switch (spec.kind) {
    case 'post_ante':
      return `${item.seatName}: posts the ante ${amt}`;
    case 'post_sb':
      return `${item.seatName}: posts small blind ${amt}`;
    case 'post_bb':
      return `${item.seatName}: posts big blind ${amt}`;
    case 'post_straddle':
      return `${item.seatName}: posts straddle ${amt}`;
    case 'blind':
      return `${item.seatName}: posts blind ${amt}`;
    case 'fold':
    case 'folded':
      return `${item.seatName}: folds`;
    case 'check':
      return `${item.seatName}: checks`;
    case 'call':
      return `${item.seatName}: calls ${amt}`;
    case 'call_allin':
      return `${item.seatName}: calls ${amt} and is all-in`;
    case 'bet':
      return `${item.seatName}: bets ${amt}`;
    case 'raise':
    case 'three_bet':
    case 'four_bet':
      return `${item.seatName}: raises to ${amt}`;
    case 'all_in':
      return `${item.seatName}: raises to ${amt} and is all-in`;
    case 'show_hand':
      return `${item.seatName}: shows hand`;
  }
}

function isPostingAction(item: TableActionLogItem): boolean {
  const kind = item.actionSpec?.kind;
  return (
    kind === 'post_ante' ||
    kind === 'post_sb' ||
    kind === 'post_bb' ||
    kind === 'post_straddle' ||
    kind === 'blind'
  );
}

/**
 * Formats a single Arena replay hand record into clean PokerStars-compatible text,
 * honoring either BB or USD chip display formatting.
 */
export function exportHandToPokerStarsText(
  record: ExportableReplayRecord,
  display?: ChipDisplayConfig
): string {
  const compactOpt = { compact: display?.unit !== 'usd' };
  const lines: string[] = [];
  const stakesText = formatStakesHeader(display);
  const firstFrame = record.frames[0];
  const lastFrame = record.frames[record.frames.length - 1];
  const buttonSeatNum = (firstFrame?.buttonSeatIndex ?? 0) + 1;

  lines.push(`PokerStars Hand #${record.handNumber}: Hold'em No Limit ${stakesText}`);
  lines.push(
    `Table 'TurnRiver Arena' ${record.tableSize}-max Seat #${buttonSeatNum} is the button`
  );

  if (firstFrame) {
    for (const seat of firstFrame.seats) {
      const stackStr = formatChips(seat.stackBb, display, compactOpt);
      lines.push(`Seat ${seat.seatIndex + 1}: ${seat.name} (${stackStr} in chips)`);
    }
  }

  const allLogs = record.actionLog ?? [];
  const postings = allLogs.filter((item) => item.street === 'preflop' && isPostingAction(item));
  for (const post of postings) {
    lines.push(formatActionLine(post, display));
  }

  const heroSeat = firstFrame?.seats.find((s) => s.isHero);
  const heroName = heroSeat?.name ?? 'Hero (You)';
  lines.push('*** HOLE CARDS ***');
  if (record.heroCards) {
    lines.push(`Dealt to ${heroName} ${formatCardsBracket(record.heroCards)}`);
  }

  const preflopActions = allLogs.filter(
    (item) => item.street === 'preflop' && !isPostingAction(item)
  );
  for (const act of preflopActions) {
    lines.push(formatActionLine(act, display));
  }

  // Find longest dealt board across frames
  let finalBoard: Card[] = [];
  for (const f of record.frames) {
    if (f.board.length > finalBoard.length) {
      finalBoard = f.board;
    }
  }

  const streetActions = (street: Street) => allLogs.filter((item) => item.street === street);

  if (finalBoard.length >= 3) {
    lines.push(`*** FLOP *** ${formatCardsBracket(finalBoard.slice(0, 3))}`);
    for (const act of streetActions('flop')) {
      lines.push(formatActionLine(act, display));
    }
  }

  if (finalBoard.length >= 4) {
    lines.push(
      `*** TURN *** ${formatCardsBracket(finalBoard.slice(0, 3))} ${formatCardsBracket([finalBoard[3]])}`
    );
    for (const act of streetActions('turn')) {
      lines.push(formatActionLine(act, display));
    }
  }

  if (finalBoard.length >= 5) {
    lines.push(
      `*** RIVER *** ${formatCardsBracket(finalBoard.slice(0, 4))} ${formatCardsBracket([finalBoard[4]])}`
    );
    for (const act of streetActions('river')) {
      lines.push(formatActionLine(act, display));
    }
  }

  const showdownSeats = (lastFrame?.seats ?? []).filter((s) => !s.folded && s.cards !== null);
  if (lastFrame?.phase === 'SHOWDOWN' && showdownSeats.length >= 2) {
    lines.push('*** SHOW DOWN ***');
    for (const seat of showdownSeats) {
      if (seat.cards) {
        lines.push(`${seat.name}: shows ${formatCardsBracket(seat.cards)}`);
      }
    }
  }

  lines.push('*** SUMMARY ***');
  const totalPotStr = formatChips(record.totalPotBb, display, compactOpt);
  const zeroRakeStr = formatChips(0, display, compactOpt);
  lines.push(`Total pot ${totalPotStr} | Rake ${zeroRakeStr}`);
  if (finalBoard.length > 0) {
    lines.push(`Board ${formatCardsBracket(finalBoard)}`);
  }
  if (lastFrame?.winnerSummary) {
    lines.push(lastFrame.winnerSummary);
  }
  const heroPosSuffix = heroSeat ? ` (${heroSeat.position})` : '';
  lines.push(
    `${heroName}${heroPosSuffix} net: ${formatSignedChips(record.netBb, display, compactOpt)}`
  );

  return lines.join('\n');
}

/**
 * Concatenates multiple hand histories into a single PokerStars-compatible session text export.
 */
export function exportSessionHandsText(
  records: ExportableReplayRecord[],
  display?: ChipDisplayConfig
): string {
  if (records.length === 0) return '';
  return records.map((rec) => exportHandToPokerStarsText(rec, display)).join('\n\n\n');
}
