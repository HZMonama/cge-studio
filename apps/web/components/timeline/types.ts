import { type RunnerRunEvent } from "@/lib/runner";

export type TimelineItem =
  | { kind: "event"; event: RunnerRunEvent }
  | { kind: "stream"; id: string; stream: "stdout" | "stderr"; createdAt: string; text: string };
