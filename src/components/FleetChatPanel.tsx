import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronsRight,
  Crown,
  MessageSquare,
  Pencil,
  Pin,
  Send,
  X,
} from "lucide-react";
import { useNow } from "@/hooks/useNow";
import { linkify } from "@/lib/linkify";
import { cn, initial, timeAgo } from "@/lib/utils";
import type { ChatMessage, ClientMsg, FleetState } from "@/types";

type Props = {
  state: FleetState;
  chat: ChatMessage[];
  selfId: string;
  isMember: boolean;
  isCreator: boolean;
  canSend: boolean; // connected + member
  send: (msg: ClientMsg) => void;
};

const COLLAPSED_KEY = "fp.chatCollapsed";
const MAX_CHAT_LEN = 500;
const MAX_PINNED_LEN = 280;

/**
 * Live ephemeral chat panel — server keeps a ~50 message ring buffer in
 * memory only. The owner can set a pinned announcement that *is* persisted
 * on the fleet. Hidden below `lg` for now.
 */
export function FleetChatPanel({
  state,
  chat,
  selfId,
  isMember,
  isCreator,
  canSend,
  send,
}: Props) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === "1",
  );
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [editingPinned, setEditingPinned] = useState(false);
  const [pinnedDraft, setPinnedDraft] = useState("");

  const now = useNow(30_000);
  const pinned = state.fleet.chat_pinned;

  // Track unread while collapsed. Reset on expand or when the latest
  // message becomes "ours".
  const lastSeenIdRef = useRef<string | null>(null);
  useEffect(() => {
    const latest = chat[chat.length - 1];
    if (!latest) {
      lastSeenIdRef.current = null;
      setUnread(0);
      return;
    }
    if (!collapsed) {
      lastSeenIdRef.current = latest.id;
      setUnread(0);
      return;
    }
    // Collapsed: count messages newer than last seen, excluding our own.
    const idx = lastSeenIdRef.current
      ? chat.findIndex((m) => m.id === lastSeenIdRef.current)
      : -1;
    const fresh = chat.slice(idx + 1).filter((m) => m.from_member_id !== selfId);
    setUnread(fresh.length);
  }, [chat, collapsed, selfId]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  // Auto-scroll to bottom on new messages, but only when the user is
  // already near the bottom — don't yank them down while they're reading
  // history.
  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  function onListScroll() {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [chat]);
  // First render after expanding from collapsed: jump to the bottom.
  useLayoutEffect(() => {
    if (!collapsed) {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [collapsed]);

  function handleSend() {
    const text = draft.trim();
    if (!text || !canSend) return;
    send({ t: "sendChat", text });
    setDraft("");
  }

  function startEditPinned() {
    setPinnedDraft(pinned ?? "");
    setEditingPinned(true);
  }
  function savePinned() {
    send({ t: "setChatPinned", text: pinnedDraft.trim() });
    setEditingPinned(false);
  }
  function clearPinned() {
    send({ t: "setChatPinned", text: "" });
    setEditingPinned(false);
  }

  // Collapsed rail (lg+ only).
  if (collapsed) {
    return (
      <aside
        className="hidden shrink-0 border border-r-0 border-edge bg-panel lg:sticky lg:top-0 lg:flex lg:w-12 lg:max-h-screen lg:flex-col lg:items-center lg:py-2"
        aria-label="Chat (collapsed)"
      >
        <button
          onClick={toggleCollapsed}
          title="Open chat"
          className="relative flex size-9 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink"
        >
          <MessageSquare size={18} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-void">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 border border-r-0 border-edge bg-panel lg:flex lg:w-72 lg:flex-col",
        "lg:sticky lg:top-0 lg:max-h-screen",
      )}
      aria-label="Fleet chat"
    >
      <header className="flex items-center justify-between border-b border-edge px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Chat
        </span>
        <button
          onClick={toggleCollapsed}
          title="Collapse chat"
          className="rounded p-1 text-ink-faint transition-colors hover:text-ink"
        >
          <ChevronsRight size={14} />
        </button>
      </header>

      <PinnedBanner
        pinned={pinned}
        isCreator={isCreator}
        editing={editingPinned}
        draft={pinnedDraft}
        onDraftChange={setPinnedDraft}
        onStartEdit={startEditPinned}
        onSave={savePinned}
        onCancel={() => setEditingPinned(false)}
        onClear={clearPinned}
      />

      <div
        ref={listRef}
        onScroll={onListScroll}
        className="flex-1 overflow-y-auto px-2 py-2"
      >
        {chat.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-ink-faint">
            {isMember
              ? "No messages yet. Say hi."
              : "Join the fleet to see and send chat."}
          </p>
        ) : (
          <ChatList
            chat={chat}
            selfId={selfId}
            ownerId={state.fleet.created_by}
            now={now}
          />
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-1.5 border-t border-edge px-2 py-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_CHAT_LEN}
          placeholder={
            !isMember
              ? "Join the fleet to chat"
              : !canSend
                ? "Reconnecting…"
                : "Message the fleet"
          }
          disabled={!canSend}
          className="min-w-0 flex-1 rounded-md border border-edge bg-void px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend || draft.trim().length === 0}
          aria-label="Send message"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-void transition-opacity disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
    </aside>
  );
}

function PinnedBanner({
  pinned,
  isCreator,
  editing,
  draft,
  onDraftChange,
  onStartEdit,
  onSave,
  onCancel,
  onClear,
}: {
  pinned: string | null;
  isCreator: boolean;
  editing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  if (editing) {
    return (
      <div className="flex flex-col gap-2 border-b border-edge bg-warn/5 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warn">
          <Pin size={11} /> Pinned message
        </div>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSave();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          maxLength={MAX_PINNED_LEN}
          rows={3}
          placeholder="Pin an announcement for the fleet…"
          autoFocus
          className="resize-none rounded-md border border-edge bg-void px-2 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] text-ink-faint">
            {draft.length}/{MAX_PINNED_LEN} · ⌘↵ saves
          </span>
          <div className="flex gap-1">
            {pinned !== null && (
              <button
                type="button"
                onClick={onClear}
                className="rounded px-2 py-1 text-[11px] text-ink-faint transition-colors hover:text-danger"
              >
                Unpin
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-2 py-1 text-[11px] text-ink-faint transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded bg-accent px-2 py-1 text-[11px] font-semibold text-void"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!pinned) {
    if (!isCreator) return null;
    return (
      <button
        onClick={onStartEdit}
        className="group flex items-center gap-1.5 border-b border-edge px-3 py-1.5 text-[11px] text-ink-faint transition-colors hover:bg-panel-2 hover:text-ink"
      >
        <Pin size={11} /> Pin an announcement…
      </button>
    );
  }

  return (
    <div className="group flex items-start gap-2 border-b border-edge bg-warn/5 px-3 py-2">
      <Pin size={12} className="mt-0.5 shrink-0 text-warn" />
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs text-ink">
        {linkify(pinned)}
      </p>
      {isCreator && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onStartEdit}
            title="Edit pinned message"
            className="rounded p-0.5 text-ink-faint hover:text-ink"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={onClear}
            title="Unpin"
            className="rounded p-0.5 text-ink-faint hover:text-danger"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function ChatList({
  chat,
  selfId,
  ownerId,
  now,
}: {
  chat: ChatMessage[];
  selfId: string;
  ownerId: string;
  now: number;
}) {
  // Group consecutive messages from the same author within a short
  // window so the avatar/name only repeats when context changes.
  const grouped = useMemo(() => groupRuns(chat), [chat]);

  return (
    <ul className="flex flex-col gap-2">
      {grouped.map((group) => {
        const head = group[0];
        const isSelf = head.from_member_id === selfId;
        const isOwner = head.from_member_id === ownerId;
        return (
          <li key={head.id} className="flex items-start gap-2">
            <div
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                isSelf ? "bg-accent text-void" : "bg-edge text-ink",
              )}
              aria-hidden
            >
              {initial(head.from_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "truncate text-xs font-semibold",
                    isSelf ? "text-accent" : "text-ink",
                  )}
                >
                  {head.from_name}
                </span>
                {isOwner && (
                  <Crown
                    size={11}
                    className="shrink-0 self-center text-warn"
                    aria-label="Fleet owner"
                  />
                )}
                <span className="shrink-0 text-[10px] text-ink-faint">
                  {timeAgoLabel(head.ts, now)}
                </span>
              </div>
              {group.map((m) => (
                <p
                  key={m.id}
                  className="whitespace-pre-wrap break-words text-xs text-ink-dim"
                >
                  {linkify(m.text)}
                </p>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function groupRuns(chat: ChatMessage[]): ChatMessage[][] {
  const out: ChatMessage[][] = [];
  for (const m of chat) {
    const last = out[out.length - 1];
    const head = last?.[0];
    const sameAuthor = head?.from_member_id === m.from_member_id;
    const within = head
      ? new Date(m.ts).getTime() - new Date(head.ts).getTime() < 5 * 60_000
      : false;
    if (last && sameAuthor && within) last.push(m);
    else out.push([m]);
  }
  return out;
}

function timeAgoLabel(iso: string, now: number): string {
  const t = timeAgo(iso, now);
  return t === "now" ? "now" : `${t} ago`;
}
