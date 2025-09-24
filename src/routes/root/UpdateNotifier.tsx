import icon from "@/assets/icon.svg";
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import {
  addToast,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Progress,
} from "@heroui/react";
import { useStore } from "@/state/store";
import { relaunch } from "@tauri-apps/plugin-process";
import { cn, None, Option, Some } from "@/lib/utils";
import AtuinEnv from "@/atuin_env";
import { getGlobalOptions } from "@/lib/global_options";
import { Update } from "@tauri-apps/plugin-updater";

export default function UpdateNotifier() {
  const [relaunching, setRelaunching] = useState(false);
  const [showingUpdate, setShowingUpdate] = useState(false);
  const showedUpdatePrompt = useStore((state) => state.showedUpdatePrompt);
  const setShowedUpdatePrompt = useStore((state) => state.setShowedUpdatePrompt);
  const [contentLength, setContentLength] = useState<Option<number>>(None);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const progress = contentLength
    .map((length) => {
      return Math.floor((downloadedBytes / length) * 100);
    })
    .unwrapOr(0);

  const availableUpdate = useStore((state) => state.availableUpdate);
  const updating = useStore((state) => state.updating);
  const setUpdating = useStore((state) => state.setUpdating);

  async function doUpdate(update: Update) {
    if (AtuinEnv.isDev) {
      console.log("UpdateNotifier: doUpdate: skipping update in dev mode");
      return;
    }

    setUpdating(Some(update.version));
    try {
      await update.downloadAndInstall((progress) => {
        switch (progress.event) {
          case "Started":
            if (progress.data.contentLength) {
              setContentLength(Some(progress.data.contentLength));
            }
            break;
          case "Progress":
            setDownloadedBytes((n) => n + progress.data.chunkLength);
            break;
        }
      });
    } catch (err) {
      console.error("UpdateNotifier: error downloading and installing update", err);
      setUpdating(None);
      addToast({
        title: "Error",
        description: "There was an error updating the app. Please try again later.",
        color: "danger",
        shouldShowTimeoutProgress: true,
      });
    }
    setRelaunching(true);
    setTimeout(() => {
      relaunch();
    }, 3000);
  }

  async function openDownloadPage() {
    await open(AtuinEnv.url("/download"));
  }

  useEffect(() => {
    if (showingUpdate) {
      setShowedUpdatePrompt(true);
      return;
    }

    if (availableUpdate && updating.isNone() && !showedUpdatePrompt) {
      const update = availableUpdate;
      setShowingUpdate(true);
      setShowedUpdatePrompt(true);

      const baseOptions = {
        title: "Update Available",
        icon: <img src={icon} alt="icon" className="h-8 w-8" />,
        description: `Atuin Desktop version ${update.version} is available for download.`,
        color: "primary",
        radius: "sm",
        timeout: Infinity,
        shouldShowTimeoutProgress: false,
        onClose: () => {
          setShowingUpdate(false);
        },
      } as const;

      if (getGlobalOptions().os === "macos") {
        addToast({
          ...baseOptions,
          endContent: (
            <Button
              size="sm"
              variant="flat"
              color="primary"
              className="p-2"
              onPress={() => doUpdate(update)}
            >
              Update
            </Button>
          ),
        });
      } else {
        addToast({
          ...baseOptions,
          classNames: {
            base: cn(["flex flex-col items-center gap-2"]),
          },
          endContent: (
            <Button
              size="sm"
              variant="flat"
              color="primary"
              className="p-2"
              onPress={() => openDownloadPage()}
            >
              Download from Atuin Hub
            </Button>
          ),
        });
      }
    }
  }, [availableUpdate, updating.unwrapOr("v<unknown>"), showedUpdatePrompt, showingUpdate]);

  if (availableUpdate && updating.isSome()) {
    return (
      <Modal isOpen={true} onClose={() => {}} hideCloseButton>
        <ModalContent>
          {!relaunching && (
            <ModalHeader>Updating to Atuin Desktop {updating.unwrapOr("<unknown>")}...</ModalHeader>
          )}
          {relaunching && <ModalHeader>Relaunching app...</ModalHeader>}
          <ModalBody>
            <div className="pb-4">
              <Progress
                value={progress}
                isIndeterminate={contentLength.isNone()}
                disableAnimation={contentLength.isNone()}
              />
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  }

  return null;
}
