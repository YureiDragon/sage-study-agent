export type ClientMessage =
  | { type: "user_message"; content: string }
  | { type: "start_session"; cert_id: string }
  | { type: "end_session" }
  | { type: "study_mode"; mode: string }
  | { type: "quiz_answers"; content: string };

export interface ServerMessage {
  type:
    | "agent_text"
    | "agent_stream_chunk"
    | "agent_stream_end"
    | "quiz_set"
    | "session_ended"
    | "error"
    | "status"
    | "server_shutdown";
  content: string;
}

export function parseClientMessage(data: string): ClientMessage | null {
  try {
    const msg = JSON.parse(data);
    if (!msg.type) return null;
    return msg as ClientMessage;
  } catch {
    return null;
  }
}
