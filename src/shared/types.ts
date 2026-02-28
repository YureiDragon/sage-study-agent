export interface CertDefinition {
  id: string;
  name: string;
  exam_code: string;
  passing_score: number;
  max_score: number;
  time_minutes: number;
  question_count: number;
  domains: DomainDefinition[];
  objectives: ObjectiveDefinition[];
}

export interface DomainDefinition {
  number: number;
  name: string;
  weight: number;
}

export interface ObjectiveDefinition {
  id: string;
  domain: number;
  title: string;
  subtopics: string[];
}

export interface MasteryScore {
  cert_id: string;
  objective_id: string;
  title: string;
  domain_name: string;
  mastery_percentage: number;
  total_answers: number;
  recent_correct: number;
  recent_total: number;
}

export interface SessionSummary {
  id: number;
  cert_id: string;
  start_time: string;
  end_time: string | null;
  topics_covered: string[];
  questions_asked: number;
  questions_correct: number;
  weak_areas_identified: string[];
  summary: string;
}

export type Difficulty = "easy" | "medium" | "hard";

export interface BridgeMessage {
  type: "user_message" | "agent_message" | "agent_stream" | "error" | "status";
  content: string;
  stream_done?: boolean;
}
