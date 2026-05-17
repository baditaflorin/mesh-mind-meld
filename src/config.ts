import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-mind-meld",
  description: "Pairs type a word in a category; match wins; mismatch becomes the new category.",
  accentHex: "#ffaa00",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
