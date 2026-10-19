export type Scene = {
  id: string;
  startSec: number;
  durationSec: number;
  purpose: string;
  onScreenText: string;
  voiceover: string;
  shot: string;
  landscapeNeeds: string;
  transitionOut: string;
};

export type Script = {
  projectId: string;
  title: string;
  version: number;
  status: string;
  durationSec: number;
  hook: string;
  scenes: Scene[];
  cta: string;
};
