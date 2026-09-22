import { requireEvidence as check } from "./errors.mjs";

// Pure state machine for the local Tuesday run.  It intentionally knows only
// source names and fixed states—not balances, transactions, URLs or workbook
// data—so progress can be shown without leaking financial information.
export const WEEKLY_SOURCES = Object.freeze(["wells", "chase_prime", "chase_sapphire", "citi", "paypal", "wealthfront"]);

export function createWeeklySequence(sources = WEEKLY_SOURCES) {
  check(Array.isArray(sources) && sources.length > 0 && sources.every(value => typeof value === "string"),
    "INVALID_SEQUENCE", "The weekly source sequence is invalid.");
  let index = 0;
  let state = "collecting";
  const finished = new Set();
  const current = () => state === "collecting" ? sources[index] : null;
  return Object.freeze({
    current,
    status: () => ({ state, current: current(), completed: [...finished] }),
    complete(source) {
      check(state === "collecting" && current() === source, "SEQUENCE_ORDER", "A source completed outside the approved refresh order.");
      finished.add(source);
      index += 1;
      if (index === sources.length) state = "ready_to_import";
      return current();
    },
    block(source) {
      check(state === "collecting" && current() === source, "SEQUENCE_ORDER", "A source failed outside the approved refresh order.");
      state = "blocked";
    },
    cancel() { if (state === "collecting") state = "cancelled"; },
    beginImport() {
      check(state === "ready_to_import", "SEQUENCE_INCOMPLETE", "Every required source must be captured before the workbook can be updated.");
      state = "importing";
    },
    imported() {
      check(state === "importing", "SEQUENCE_ORDER", "The workbook import was not expected.");
      state = "complete";
    },
    importBlocked() {
      check(state === "importing", "SEQUENCE_ORDER", "The workbook import was not expected.");
      state = "blocked";
    },
  });
}
