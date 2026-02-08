"use client";

import { createContext, useContext } from "react";
import type { GroupInfo, Instruction } from "./types";

export interface InstructionEditorContextValue {
  instructions: Instruction[];
  internalGroups: GroupInfo[];
  addInstruction: (groupId?: string | null) => void;
  updateInstruction: (index: number, step: string) => void;
  removeInstruction: (index: number) => void;
  moveInstruction: (index: number, direction: "up" | "down") => void;
  addGroup: () => void;
  removeGroup: (groupId: string) => void;
  moveGroup: (groupId: string, direction: "up" | "down") => void;
  updateGroupName: (groupId: string, name: string) => void;
  isFirstGroup: (groupId: string) => boolean;
  isLastGroup: (groupId: string) => boolean;
}

export const InstructionEditorContext =
  createContext<InstructionEditorContextValue | null>(null);

export function useInstructionEditor(): InstructionEditorContextValue {
  const context = useContext(InstructionEditorContext);
  if (!context) {
    throw new Error(
      "useInstructionEditor must be used within InstructionEditorProvider"
    );
  }
  return context;
}
