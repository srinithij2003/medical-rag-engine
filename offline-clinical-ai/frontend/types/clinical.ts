export type Extraction = {
  symptoms: string[];
  duration: string | null;
  conditions: string[];
  blood_pressure: string | null;
  medications: string[];
  allergies: string[];
  vitals: Record<string, unknown>;
  diagnosis: string[];
  lab_values: Record<string, unknown>;
};

export type StreamEvent =
  | { type: 'meta'; model: string }
  | { type: 'token'; delta: string }
  | { type: 'result'; result: Extraction }
  | { type: 'error'; message: string }
  | { type: 'done' };
