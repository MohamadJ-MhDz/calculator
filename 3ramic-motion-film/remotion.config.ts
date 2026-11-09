/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import fs from "node:fs";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(1);
// Software WebGL compiles shaders slowly on the first frame of each tab.
Config.setDelayRenderTimeoutInMilliseconds(300000);

// WebGL without a GPU: ANGLE on SwiftShader.
Config.setChromiumOpenGlRenderer("swangle");

// This cloud sandbox cannot reach remotion.media to download Remotion's own
// Chrome Headless Shell, so fall back to the pre-installed one when present.
// On a normal machine this block is skipped and Remotion manages its browser.
const LOCAL_HEADLESS_SHELL =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (fs.existsSync(LOCAL_HEADLESS_SHELL)) {
  Config.setBrowserExecutable(LOCAL_HEADLESS_SHELL);
}
