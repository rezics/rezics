import { spawn } from "node:child_process";

export interface EditorEnv {
  VISUAL?: string;
  EDITOR?: string;
}

export function resolveEditorCommand(
  envOverride: EditorEnv = process.env as EditorEnv,
  platform: NodeJS.Platform = process.platform,
): string {
  const visual = envOverride.VISUAL?.trim();
  if (visual) return visual;
  const editor = envOverride.EDITOR?.trim();
  if (editor) return editor;
  if (platform === "win32") return "notepad";
  return "vi";
}

export async function spawnEditor(
  command: string,
  filePath: string,
): Promise<void> {
  await new Promise<void>((resolveExit, rejectExit) => {
    const child = spawn(command, [filePath], {
      stdio: "inherit",
      shell: true,
    });
    child.once("error", (err) => {
      rejectExit(
        new Error(
          `Failed to launch editor "${command}": ${err.message}. Set $VISUAL or $EDITOR to a valid command.`,
        ),
      );
    });
    child.once("exit", (code) => {
      if (code !== 0) {
        rejectExit(new Error(`Editor "${command}" exited with code ${code}.`));
        return;
      }
      resolveExit();
    });
  });
}
