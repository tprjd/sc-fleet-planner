import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import { toast } from "sonner";
import { getMemberId, getToken, setToken } from "@/lib/identity";
import type { ChatMessage, ClientMsg, FleetState, ServerMsg } from "@/types";

const CHAT_CLIENT_CAP = 50; // matches the server's ring buffer

const WORKER_HOST = import.meta.env.VITE_WORKER_HOST ?? "localhost:8787";

export type FleetStatus = "connecting" | "ready" | "not-found";
export type ConnectionStatus = "connecting" | "connected" | "reconnecting";

type Options = {
  /** If set, create the fleet with this name when it doesn't exist yet. */
  create?: string;
  displayName: string;
};

/**
 * Live connection to a fleet's Durable Object room. The room broadcasts a
 * full state snapshot on every change; `send` dispatches action messages.
 * PartySocket reconnects automatically and the room re-sends state on
 * reconnect, so there's nothing to refetch.
 */
export function useFleet(code: string | undefined, opts: Options) {
  const [state, setState] = useState<FleetState | null>(null);
  const [status, setStatus] = useState<FleetStatus>("connecting");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const socketRef = useRef<PartySocket | null>(null);

  // Connection options are read once at connect time, not reactive.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!code) return;
    setStatus("connecting");
    setState(null);
    setChat([]);
    setConnectionStatus("connecting");

    // PartySocket re-invokes this function on each (re)connection, so a
    // freshly-minted token in localStorage is picked up automatically.
    const buildQuery = (): Record<string, string> => {
      const q: Record<string, string> = { m: getMemberId() };
      const t = getToken(code);
      if (t) q.t = t;
      if (optsRef.current.create !== undefined) {
        q.create = optsRef.current.create;
        q.name = optsRef.current.displayName;
      }
      return q;
    };

    const socket = new PartySocket({
      host: WORKER_HOST,
      party: "fleet",
      room: code,
      query: buildQuery,
    });
    socketRef.current = socket;

    socket.addEventListener("open", () => setConnectionStatus("connected"));
    // PartySocket retries automatically after `close`; treat any drop as
    // "reconnecting" until the next open lands.
    socket.addEventListener("close", () => setConnectionStatus("reconnecting"));

    socket.addEventListener("message", (e) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(e.data as string);
      } catch {
        return;
      }
      if (msg.t === "state") {
        setState(msg.state);
        setStatus("ready");
      } else if (msg.t === "notFound") {
        setState(null);
        setStatus("not-found");
      } else if (msg.t === "token") {
        if (code) setToken(code, msg.value);
      } else if (msg.t === "chatHistory") {
        setChat(msg.messages);
      } else if (msg.t === "chat") {
        setChat((prev) => {
          const next = [...prev, msg.message];
          return next.length > CHAT_CLIENT_CAP
            ? next.slice(-CHAT_CLIENT_CAP)
            : next;
        });
      } else if (msg.t === "error") {
        toast.error(msg.message);
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [code]);

  const send = useCallback((msg: ClientMsg) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  return { state, status, send, connectionStatus, chat };
}
