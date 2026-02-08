export interface Instruction {
  step: string;
  group_id?: string | null;
}

export interface GroupInfo {
  id: string;
  name: string;
}

export interface InstructionEditorProps {
  instructions: Instruction[];
  groups?: GroupInfo[];
  onChange: (instructions: Instruction[], groups: GroupInfo[]) => void;
}

export type EditorItem =
  | { type: "group"; id: string; name: string }
  | { type: "instruction"; index: number; data: Instruction };
