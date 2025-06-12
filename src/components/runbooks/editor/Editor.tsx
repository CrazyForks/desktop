import "./index.css";

import { Spinner } from "@heroui/react";

import { filterSuggestionItems } from "@blocknote/core";

import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  SideMenu,
  SideMenuController,
  DragHandleMenu,
  RemoveBlockItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { FolderOpenIcon, VariableIcon, TextCursorInputIcon, EyeIcon } from "lucide-react";

import { AIGeneratePopup } from "./AIGeneratePopup";
import AIPopup from "./ui/AIPopup";
import { isAIEnabled } from "@/lib/ai/block_generator";
import { SparklesIcon } from "lucide-react";

import { insertSQLite } from "@/components/runbooks/editor/blocks/SQLite/SQLite";
import { insertPostgres } from "@/components/runbooks/editor/blocks/Postgres/Postgres";
import { insertMySQL } from "@/components/runbooks/editor/blocks/MySQL/MySQL";
import { insertClickhouse } from "@/components/runbooks/editor/blocks/Clickhouse/Clickhouse";
import { insertScript } from "@/components/runbooks/editor/blocks/Script/Script";
import { insertPrometheus } from "@/components/runbooks/editor/blocks/Prometheus/Prometheus";
import { insertEditor } from "@/components/runbooks/editor/blocks/Editor/Editor";
import { insertSshConnect } from "@/components/runbooks/editor/blocks/ssh/SshConnect";
import { insertHostSelect } from "@/components/runbooks/editor/blocks/Host";
import { insertLocalVar } from "@/components/runbooks/editor/blocks/LocalVar";

import Runbook from "@/state/runbooks/runbook";
import { insertHttp } from "@/lib/blocks/http";
import { uuidv7 } from "uuidv7";
import { DuplicateBlockItem } from "./ui/DuplicateBlockItem";

import { schema } from "./create_editor";
import RunbookEditor from "@/lib/runbook_editor";
import { useStore } from "@/state/store";
import { usePromise } from "@/lib/utils";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import BlockBus from "@/lib/workflow/block_bus";
import { invoke } from "@tauri-apps/api/core";
import { convertBlocknoteToAtuin } from "@/lib/workflow/blocks/convert";
import track_event from "@/tracking";
import { saveScrollPosition, restoreScrollPosition, getScrollPosition } from "@/utils/scroll-position";
import { insertDropdown } from "./blocks/Dropdown/Dropdown";
import { insertTerminal } from "@/lib/blocks/terminal";
import { insertLocalDirectory } from "@/lib/blocks/localdirectory";


// Fix for react-dnd interference with BlockNote drag-and-drop
// React-dnd wraps dataTransfer in a proxy that blocks access during drag operations
// We capture the original data during dragstart and resynthesize clean drop events
let originalDragData: any = null;


const insertDirectory = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Directory",
  subtext: "Set current working directory (synced)",
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "directory" });

    editor.insertBlocks(
      [
        {
          type: "directory",
        },
      ],
      editor.getTextCursorPosition().block.id,
      "before",
    );
  },
  icon: <FolderOpenIcon size={18} />,
  aliases: ["directory", "dir", "folder"],
  group: "Execute",
});

const insertEnv = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Environment Variable",
  subtext: "Set environment variable for all subsequent code blocks",
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "env" });

    editor.insertBlocks(
      [
        {
          type: "env",
        },
      ],
      editor.getTextCursorPosition().block.id,
      "before",
    );
  },
  icon: <VariableIcon size={18} />,
  aliases: ["env", "environment", "variable"],
  group: "Execute",
});

const insertVar = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Template Variable",
  subtext: "Set template variable for use in subsequent blocks",
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "var" });

    editor.insertBlocks(
      [
        {
          type: "var",
        },
      ],
      editor.getTextCursorPosition().block.id,
      "before",
    );
  },
  icon: <TextCursorInputIcon size={18} />,
  aliases: ["var", "template", "variable"],
  group: "Execute",
});

const insertVarDisplay = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Display Variable",
  subtext: "Show the current value of a template variable",
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "var_display" });

    editor.insertBlocks(
      [
        {
          type: "var_display",
        },
      ],
      editor.getTextCursorPosition().block.id,
      "before",
    );
  },
  icon: <EyeIcon size={18} />,
  aliases: ["show", "display", "view", "variable"],
  group: "Execute",
});

// Calculate popup position relative to a block
const calculatePopupPosition = (editor: any, blockId?: string): { x: number; y: number } => {
  try {
    // Get the current cursor position if no blockId provided
    const targetBlockId = blockId || editor.getTextCursorPosition().block.id;
    
    // Get the DOM element for the target block
    const blockElement = editor.domElement?.querySelector(`[data-id="${targetBlockId}"]`);
    
    if (blockElement && editor.domElement) {
      const blockRect = blockElement.getBoundingClientRect();
      const editorRect = editor.domElement.getBoundingClientRect();
      
      // Calculate position relative to the editor container
      const relativeX = blockRect.left - editorRect.left + 20;
      const relativeY = blockRect.top - editorRect.top + 10;
      
      return { x: relativeX, y: relativeY };
    } else {
      // Fallback: position near top-left of editor
      return { x: 50, y: 50 };
    }
  } catch (error) {
    console.warn("Could not calculate popup position, using fallback:", error);
    // Fallback to center if APIs fail
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
};

// AI Generate function
const insertAIGenerate = (editor: any, showAIPopup: (position: { x: number; y: number }) => void) => ({
  title: "AI Generate",
  subtext: "Generate blocks from a natural language prompt (or press ⌘K)",
  onItemClick: () => {
    track_event("runbooks.ai.slash_menu_popup");
    const position = calculatePopupPosition(editor);
    showAIPopup(position);
  },
  icon: <SparklesIcon size={18} />,
  aliases: ["ai", "generate", "prompt"],
  group: "AI",
});

type EditorProps = {
  runbook: Runbook | null;
  editable: boolean;
  runbookEditor: RunbookEditor;
};

export default function Editor({ runbook, editable, runbookEditor }: EditorProps) {
  const editor = usePromise(runbookEditor.getEditor());
  const colorMode = useStore((state) => state.functionalColorMode);
  const fontSize = useStore((state) => state.fontSize);
  const fontFamily = useStore((state) => state.fontFamily);
  const serialExecuteRef = useRef<(() => void) | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [aiPopupVisible, setAiPopupVisible] = useState(false);
  const [aiPopupPosition, setAiPopupPosition] = useState({ x: 0, y: 0 });
  const [aiEnabledState, setAiEnabledState] = useState(false);
  const [isAIEditPopupOpen, setIsAIEditPopupOpen] = useState(false);
  const [currentEditBlock, setCurrentEditBlock] = useState<any>(null);
  const [aiEditPopupPosition, setAiEditPopupPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(true);

  // Check AI enabled status
  useEffect(() => {
    isAIEnabled().then(setAiEnabledState);
  }, []);

  const showAIPopup = useCallback((position: { x: number; y: number }) => {
    setAiPopupPosition(position);
    setAiPopupVisible(true);
  }, []);

  const closeAIPopup = useCallback(() => {
    setAiPopupVisible(false);
  }, []);

  const getEditorContext = useCallback(async () => {
    if (!editor) return undefined;
    
    try {
      // Get current document blocks
      const blocks = editor.document;
      
      // Get cursor position (current block)
      const textCursorPosition = editor.getTextCursorPosition();
      const currentBlockId = textCursorPosition.block.id;
      
      // Find current block index
      const currentBlockIndex = blocks.findIndex(block => block.id === currentBlockId);
      
      return {
        blocks,
        currentBlockId,
        currentBlockIndex: currentBlockIndex >= 0 ? currentBlockIndex : 0
      };
    } catch (error) {
      console.warn("Could not get editor context:", error);
      return undefined;
    }
  }, [editor]);

  const handleAIGenerate = useCallback((blocks: any[]) => {
    if (!editor) return;

    const currentPosition = editor.getTextCursorPosition();
    
    editor.insertBlocks(
      blocks,
      currentPosition.block.id,
      "after"
    );
    closeAIPopup();
  }, [editor, closeAIPopup]);

  const serialExecuteCallback = useCallback(async () => {
    if (!editor || !runbook) {
      return;
    }

    let workflow = editor.document
      .map(convertBlocknoteToAtuin)
      .filter((block) => block !== null)
      .map((block) => ({ type: block.typeName, ...block.object() }));
    console.log(workflow);
    await invoke("workflow_serial", { id: runbook.id, workflow });
  }, [editor, runbook]);



  useEffect(() => {
    if (!editor || !runbook || serialExecuteRef.current) {
      return;
    }

    serialExecuteRef.current = BlockBus.get().subscribeStartWorkflow(
      runbook.id,
      serialExecuteCallback,
    );

    return () => {
      if (serialExecuteRef.current) {
        BlockBus.get().unsubscribeStartWorkflow(runbook.id, serialExecuteRef.current);
      }
    };
  }, [editor, runbook]);

  // Add keyboard shortcut for AI popup (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        
        if (!editor) return;
        
        try {
          // Get the current cursor position in the editor
          const cursorPosition = editor.getTextCursorPosition();
          const currentBlock = cursorPosition.block;
          
          // Check if we're in an empty paragraph (for generation) or specific block (for editing)
          const isEmptyParagraph = currentBlock.type === "paragraph" && 
            (!currentBlock.content || currentBlock.content.length === 0);
          
          if (isEmptyParagraph) {
            // Generate new blocks mode
            track_event("runbooks.ai.keyboard_shortcut");
            const position = calculatePopupPosition(editor, currentBlock.id);
            showAIPopup(position);
          } else {
            // Edit existing block mode
            track_event("runbooks.ai.edit_block", { blockType: currentBlock.type });
            const position = calculatePopupPosition(editor, currentBlock.id);
            setAiEditPopupPosition(position);
            setIsAIEditPopupOpen(true);
            setCurrentEditBlock(currentBlock);
          }
        } catch (error) {
          console.warn("Could not get cursor position for Cmd+K, using fallback:", error);
          // Fallback to center if APIs fail
          showAIPopup({ x: 250, y: 100 });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, showAIPopup]);

  // Handle visibility and scroll restoration when runbook changes
  useLayoutEffect(() => {
    if (!runbook?.id) return;
    
    const savedPosition = getScrollPosition(runbook.id);
    if (savedPosition > 0) {
      // Hide temporarily while we restore position
      setIsVisible(false);
      
      requestAnimationFrame(() => {
        try {
          if (scrollContainerRef.current) {
            restoreScrollPosition(scrollContainerRef.current, runbook.id);
          }
        } catch (error) {
          console.warn("Failed to restore scroll position:", error);
        } finally {
          // Always restore visibility regardless of scroll restoration success
          setIsVisible(true);
        }
      });
    } else {
      // Ensure visibility is set when no scroll position to restore
      setIsVisible(true);
    }
  }, [runbook?.id]);

  // Debounced scroll handler
  const timeoutRef = useRef<number | null>(null);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!runbook?.id) return;
    
    const target = e.currentTarget;
    
    // Debounce to avoid excessive localStorage writes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      console.log("saving scroll position for runbook", runbook.id);
      saveScrollPosition(runbook.id, target.scrollTop);
    }, 100);
  }, [runbook?.id]);

  if (!editor || !runbook) {
    return (
      <div className="flex w-full h-full flex-col justify-center items-center">
        <Spinner />
      </div>
    );
  }

  // Renders the editor instance.
  return (
    <div
      ref={scrollContainerRef}
      className="overflow-y-scroll editor flex-grow pt-3 relative"
      style={{
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
        visibility: isVisible ? 'visible' : 'hidden',
      }}
      onScroll={handleScroll}
      onDragStart={(e) => {
        // Capture original drag data before react-dnd can wrap it
        originalDragData = {
          effectAllowed: e.dataTransfer.effectAllowed,
          types: Array.from(e.dataTransfer.types),
          data: {},
        };

        e.dataTransfer.types.forEach((type) => {
          try {
            originalDragData.data[type] = e.dataTransfer.getData(type);
          } catch (err) {
            // Some types may not be readable during dragstart
          }
        });
      }}
      onDrop={(e) => {
        if (!originalDragData) {
          return;
        }

        // This is only the case if the user is dragging a block from the sidebar
        if ((e.target as Element).matches(".bn-editor")) {
          return;
        }

        const view = editor._tiptapEditor.view;

        if (!view || !originalDragData.data["blocknote/html"]) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Create clean DataTransfer with preserved data
        const cleanDataTransfer = new DataTransfer();
        Object.keys(originalDragData.data).forEach((type) => {
          cleanDataTransfer.setData(type, originalDragData.data[type]);
        });

        // Create fresh drop event with clean DataTransfer
        const syntheticEvent = new DragEvent("drop", {
          bubbles: false,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          dataTransfer: cleanDataTransfer,
        });

        // Mark as synthetic to prevent recursion
        (syntheticEvent as any).synthetic = true;

        view.dispatchEvent(syntheticEvent);

        originalDragData = null;
      }}
      onDragOver={(e) => e.preventDefault()}
      onClick={(e) => {
        // Only return if clicking inside editor content, not modals/inputs
        if (
          (e.target as Element).matches(".editor .bn-container *") ||
          (e.target as HTMLElement).tagName === "INPUT"
        )
          return;
        // If the user clicks below the document, focus on the last block
        // But if the last block is not an empty paragraph, create it :D
        let blocks = editor.document;
        let lastBlock = blocks[blocks.length - 1];
        let id = lastBlock.id;
        if (lastBlock.type !== "paragraph" || lastBlock.content.length > 0) {
          id = uuidv7();
          editor.insertBlocks(
            [
              {
                id,
                type: "paragraph",
                content: "",
              },
            ],
            lastBlock.id,
            "after",
          );
        }
        editor.focus();
        editor.setTextCursorPosition(id, "start");
      }}
    >
      <BlockNoteView
        editor={editor}
        slashMenu={false}
        formattingToolbar={false}
        className="pb-[200px]"
        sideMenu={false}
        onChange={() => {
          runbookEditor.save(runbook, editor);
        }}
        theme={colorMode === "dark" ? "dark" : "light"}
        editable={editable}
        onDragStart={(e) => {
          console.log("onDragStart", e);
        }}
      >
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query: any) =>
            filterSuggestionItems(
              [
                ...getDefaultReactSlashMenuItems(editor),
                // AI group (only if enabled)
                ...(aiEnabledState ? [insertAIGenerate(editor, showAIPopup)] : []),

                // Execute group
                insertTerminal(editor as any),
                insertEnv(editor as any),
                insertVar(editor as any),
                insertVarDisplay(editor as any),
                insertLocalVar(schema)(editor),
                insertScript(schema)(editor),
                insertDirectory(editor as any),
                insertLocalDirectory(editor as any),
                insertDropdown(schema)(editor),

                // Monitoring group
                insertPrometheus(schema)(editor),

                // Database group
                insertSQLite(schema)(editor),
                insertPostgres(schema)(editor),
                insertMySQL(schema)(editor),
                insertClickhouse(schema)(editor),

                // Network group
                insertHttp(schema)(editor),
                insertSshConnect(schema)(editor),
                insertHostSelect(schema)(editor),

                // Misc group
                insertEditor(schema)(editor),
              ],
              query,
            )
          }
        />

        <SideMenuController
          sideMenu={(props: any) => (
            <SideMenu
              {...props}
              style={{ zIndex: 0 }}
              dragHandleMenu={(props) => (
                <DragHandleMenu {...props}>
                  <RemoveBlockItem {...props}>Delete</RemoveBlockItem>
                  <DuplicateBlockItem {...props} />
                </DragHandleMenu>
              )}
            ></SideMenu>
          )}
        />

      </BlockNoteView>
      
      {/* AI popup positioned relative to editor container (only if AI is enabled) */}
      {aiEnabledState && (
        <AIGeneratePopup
          isVisible={aiPopupVisible}
          position={aiPopupPosition}
          onGenerate={handleAIGenerate}
          onClose={closeAIPopup}
          getEditorContext={getEditorContext}
        />
      )}
      
      {/* AI edit popup for modifying existing blocks */}
      {aiEnabledState && (
        <AIPopup
          isOpen={isAIEditPopupOpen}
          onClose={() => setIsAIEditPopupOpen(false)}
          editor={editor}
          currentBlock={currentEditBlock}
          position={aiEditPopupPosition}
          getEditorContext={getEditorContext}
        />
      )}
    </div>
  );
}