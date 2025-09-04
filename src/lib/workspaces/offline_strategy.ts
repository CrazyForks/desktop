import Workspace from "@/state/runbooks/workspace";
import WorkspaceStrategy, { DoFolderOp } from "./strategy";
import { exists, stat, readDir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, resolve } from "@tauri-apps/api/path";
import { Option, Some, None, Result, Ok, Err } from "@binarymuse/ts-stdlib";
import { DialogBuilder } from "@/components/Dialogs/dialog";
import { uuidv7 } from "uuidv7";
import Runbook, { OfflineRunbook } from "@/state/runbooks/runbook";
import * as commands from "./commands";
import { WorkspaceError } from "@/rs-bindings/WorkspaceError";
import { NodeApi } from "react-arborist";
import { TreeRowData } from "@/components/runbooks/List/TreeView";

interface WorkspaceFolderError {
  fatal: boolean;
  type: "not_empty" | "not_directory" | "not_exist" | "not_writable" | "is_subdir_of_workspace";
  extra?: string;
}

async function parentDir(folder: string): Promise<Option<string>> {
  const parent = await resolve(folder, "..");
  if (parent === folder) {
    return None;
  }
  return Some(parent);
}

async function findParentWorkspace(folder: string): Promise<Option<string>> {
  try {
    const contents = await readDir(folder);
    if (
      // TODO[mkt]: Check for [workspace] section in the toml file???
      contents.some((file) => file.isFile && file.name.toLowerCase() === "atuin.toml")
    ) {
      return Some(folder);
    }
  } catch (err) {
    // Couldn't read the directory
  }

  const parent = await parentDir(folder);
  if (parent.isSome()) {
    return findParentWorkspace(parent.unwrap());
  }
  return None;
}

async function checkWorkspaceFolder(folder: string): Promise<Option<WorkspaceFolderError>> {
  const doesExist = await exists(folder);
  if (!doesExist) {
    return Some<WorkspaceFolderError>({ fatal: true, type: "not_exist" });
  }

  const stats = await stat(folder);
  if (!stats.isDirectory) {
    return Some<WorkspaceFolderError>({ fatal: true, type: "not_directory" });
  }

  try {
    const testfile = "." + uuidv7();
    const testFilePath = await join(folder, testfile);
    await writeTextFile(testFilePath, testfile);
    const contents = await readTextFile(testFilePath);
    await remove(testFilePath);
    if (contents !== testfile) {
      return Some<WorkspaceFolderError>({ fatal: true, type: "not_writable" });
    }
  } catch (err) {
    return Some<WorkspaceFolderError>({ fatal: true, type: "not_writable" });
  }

  const dirContents = await readDir(folder);
  if (dirContents.length > 0) {
    return Some<WorkspaceFolderError>({
      fatal: false,
      type: "not_empty",
    });
  }

  const parentWorkspace = await findParentWorkspace(folder);
  if (parentWorkspace.isSome()) {
    return Some<WorkspaceFolderError>({
      fatal: false,
      type: "is_subdir_of_workspace",
      extra: parentWorkspace.unwrap(),
    });
  }

  return None;
}

export default class OfflineStrategy implements WorkspaceStrategy {
  constructor(private workspace: Workspace) {}

  async createWorkspace(): Promise<Result<Workspace, WorkspaceError>> {
    if (!this.workspace.get("folder")) {
      throw new Error("You must select a folder to store your workspace locally.");
    }

    const error = await checkWorkspaceFolder(this.workspace.get("folder")!);
    if (error.isSome()) {
      const type = error.unwrap().type;
      switch (type) {
        case "not_empty":
          const notEmptyAnswer = await new DialogBuilder()
            .title("Selected directory is not empty")
            .icon("warning")
            .message(
              "The selected directory is not empty. Are you sure you want to use it? Any conflicting files will be overwritten.",
            )
            .action({ label: "Cancel", value: "cancel", variant: "flat" })
            .action({ label: "OK", value: "ok", variant: "flat", color: "primary" })
            .build();
          if (notEmptyAnswer === "cancel") {
            return Err({
              type: "WorkspaceCreateError",
              data: {
                workspace_id: this.workspace.get("id")!,
                message: "Workspace creation canceled.",
              },
            } as WorkspaceError);
          }
          break;
        case "is_subdir_of_workspace":
          const dir = error.unwrap().extra!;
          const parentAnswer = await new DialogBuilder()
            .title("Selected path is a subdirectory of a workspace")
            .icon("warning")
            .message(
              `The folder you selected is a subdirectory of an existing workspace (${dir}). Are you sure you want to use your selected folder? Use of the parent workspace may result in files from the new workspace being overwritten.`,
            )
            .action({ label: "Cancel", value: "cancel", variant: "flat" })
            .action({ label: "OK", value: "ok", variant: "flat", color: "primary" })
            .build();
          if (parentAnswer === "cancel") {
            return Err({
              type: "WorkspaceCreateError",
              data: {
                workspace_id: this.workspace.get("id")!,
                message: "Workspace creation canceled.",
              },
            } as WorkspaceError);
          }
          break;
        case "not_directory":
          return Err({
            type: "WorkspaceCreateError",
            data: {
              workspace_id: this.workspace.get("id")!,
              message: "Selected path is not a directory.",
            },
          } as WorkspaceError);
        case "not_exist":
          return Err({
            type: "WorkspaceCreateError",
            data: {
              workspace_id: this.workspace.get("id")!,
              message: "Selected path does not exist.",
            },
          } as WorkspaceError);
        case "not_writable":
          return Err({
            type: "WorkspaceCreateError",
            data: {
              workspace_id: this.workspace.get("id")!,
              message: "Selected path is not writable.",
            },
          } as WorkspaceError);
        default:
          exhaustiveCheck(type);
      }
    }

    try {
      await this.workspace.save();
    } catch (err) {
      if (err instanceof Error) {
        return Err({
          type: "WorkspaceCreateError",
          data: {
            workspace_id: this.workspace.get("id")!,
            message: err.message,
          },
        } as WorkspaceError);
      } else {
        return Err({
          type: "WorkspaceCreateError",
          data: {
            workspace_id: this.workspace.get("id")!,
            message: "An unknown error occurred while saving the workspace.",
          },
        } as WorkspaceError);
      }
    }

    let result = await commands.createWorkspace(
      this.workspace.get("folder")!,
      this.workspace.get("id")!,
      this.workspace.get("name")!,
    );

    if (result.isErr()) {
      return Err(result.unwrapErr());
    }

    return Ok(this.workspace);
  }

  async renameWorkspace(newName: string): Promise<Result<undefined, WorkspaceError>> {
    // Set the workspace name immediately as an "optimistic update."
    // TODO[mkt]: If a FS event comes through before we can flush to disk, the old name may briefly reappear.
    this.workspace.set("name", newName);
    await this.workspace.save();

    let result = await commands.renameWorkspace(this.workspace.get("id")!, newName);
    if (result.isErr()) {
      return Err(result.unwrapErr());
    }

    return Ok(undefined);
  }

  async deleteWorkspace(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async createRunbook(
    parentFolderId: string | null,
    activateRunbook: (runbookId: string) => void,
  ): Promise<Result<string, WorkspaceError>> {
    let result = await Ok.from<Runbook | null, WorkspaceError>(
      OfflineRunbook.create(this.workspace, parentFolderId),
    );
    console.log("createRunbook result", result);
    if (result.isOk() && result.unwrap() === null) {
      result = Err({
        type: "WorkspaceCreateError",
        data: {
          workspace_id: this.workspace.get("id")!,
          message: "Failed to create runbook",
        },
      } as WorkspaceError);
    }

    if (result.isErr()) {
      const err = result.unwrapErr();
      let message = "Failed to create runbook";
      if ("message" in err.data) {
        message = `Failed to create runbook: ${err.data.message}`;
      }
      new DialogBuilder()
        .title("Error creating runbook")
        .message(message)
        .action({ label: "OK", value: "ok" })
        .build();
      return Err(err);
    }

    const runbook = result.unwrap();
    activateRunbook(runbook!.id);
    return Ok(runbook!.id);
  }

  async deleteRunbook(
    _doFolderOp: DoFolderOp,
    runbookId: string,
  ): Promise<Result<undefined, WorkspaceError>> {
    return commands.deleteRunbook(this.workspace.get("id")!, runbookId);
  }

  async createFolder(
    _doFolderOp: DoFolderOp,
    parentId: string | null,
    name: string,
  ): Promise<Result<string, WorkspaceError>> {
    return commands.createFolder(this.workspace.get("id")!, parentId, name);
  }

  async renameFolder(
    _doFolderOp: DoFolderOp,
    folderId: string,
    newName: string,
  ): Promise<Result<undefined, WorkspaceError>> {
    let result = await commands.renameFolder(this.workspace.get("id")!, folderId, newName);
    if (result.isErr()) {
      let err = result.unwrapErr();
      if (err.type === "FolderRenameError") {
        return Err({
          type: "FolderRenameError",
          data: {
            workspace_id: this.workspace.get("id")!,
            folder_id: folderId,
            message: `Failed to rename folder: ${err.data.message}`,
          },
        } as WorkspaceError);
      } else {
        return Err({
          type: "FolderRenameError",
          data: {
            workspace_id: this.workspace.get("id")!,
            folder_id: folderId,
            message: "Failed to rename folder",
          },
        } as WorkspaceError);
      }
    }

    return Ok(undefined);
  }

  async deleteFolder(
    _doFolderOp: DoFolderOp,
    folderId: string,
    _descendents: NodeApi<TreeRowData>[],
  ): Promise<Result<undefined, WorkspaceError>> {
    const result = await commands.deleteFolder(this.workspace.get("id")!, folderId);
    if (result.isErr()) {
      let err = result.unwrapErr();
      if (err.type === "FolderDeleteError") {
        return Err({
          type: "FolderDeleteError",
          data: {
            workspace_id: this.workspace.get("id")!,
            folder_id: folderId,
            message: `Failed to delete folder: ${err.data.message}`,
          },
        } as WorkspaceError);
      } else {
        return Err({
          type: "FolderDeleteError",
          data: {
            workspace_id: this.workspace.get("id")!,
            folder_id: folderId,
            message: "Failed to delete folder",
          },
        } as WorkspaceError);
      }
    }

    return Ok(undefined);
  }

  async moveItems(
    _doFolderOp: DoFolderOp,
    ids: string[],
    parentId: string | null,
    _index: number,
  ): Promise<Result<undefined, WorkspaceError>> {
    return commands.moveItems(this.workspace.get("id")!, ids, parentId);
  }
}

function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled value: ${value}`);
}
