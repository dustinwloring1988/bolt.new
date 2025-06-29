# Project Feature Implementation Plan

This plan details steps to implement new features in **bolt.new**, using examples from the **bolt.diy** repository’s merged pull requests and commits. Each feature section lists tasks and relevant code references from bolt.diy to guide implementation.

## 1. Chat Title Editing

Allow users to rename a chat conversation’s title, like in [PR #483](https://github.com/stackblitz-labs/bolt.diy/pull/483). Implementation steps:

* **Editable Title UI:** Make the chat title text editable (e.g. on click, it turns into an input field).
* **Validation:** Ensure the new title meets any character rules (bolt.diy implemented chat title restrictions). For example, enforce length limits or strip illegal characters.
* **Save Change:** On confirming edit, update the chat’s metadata (e.g., save in IndexedDB or backend).
* **Edge Cases:** Prevent empty names and provide feedback.
* **Testing:** Verify the title updates persist and display correctly in the sidebar.

> Citation: For guidance, see bolt.diy’s note on **chat title restrictions**, indicating existing logic around chat titles.

## 2. Export and Delete All Chats

Add buttons in Settings to export all chat history and to delete all chats at once. Bolt.diy’s “Import and Export Chats” PR [PR #372](https://github.com/stackblitz-labs/bolt.diy/pull/372) & [PR #1586](https://github.com/stackblitz-labs/bolt.diy/pull/1586) already provides individual chat export. The tasks are:

* **Export All Chats:** Build on the individual-export feature (bolt.diy shows exporting a single chat to JSON). In Settings, add a control that loops through all chats and downloads them (e.g., concatenate exports). You can reference the export logic from PR #372.
* **Delete All Chats:** Implement a “Clear All Chats” action. The bolt.diy PR #1586 added *bulk delete chats* functionality. In Settings, add a button that calls the same routine as deleting a chat repeatedly or the bulk delete API.
* **User Confirmation:** Always prompt the user to confirm before deleting all chats to prevent data loss.
* **Feedback:** After export/delete, show success notifications (see bolt.diy’s UI feedback approach in these PRs).

> Citations: bolt.diy’s PR #372 enables exporting chats (e.g. “Export chat from sidebar”), and PR #1586 adds the ability to bulk-delete chats from the sidebar.

## 3. Local Import of Project

Allow users to import a local project folder into the chat. The bolt.diy [PR #413](https://github.com/stackblitz-labs/bolt.diy/pull/413) (“Folder Import”) demonstrates reading a directory, filtering files, and sending their contents as a chat artifact. Key steps from that PR include:

* **File Input UI:** Add a hidden `<input type="file" webkitdirectory>` component to select a folder (bolt.diy’s `ImportFolderButton` does this). Trigger it from a button in the UI.
* **Ignore Patterns:** Filter out node\_modules, `.git`, lock files, etc., using regex patterns (see `IGNORE_PATTERNS` in bolt.diy’s import code).
* **Binary File Detection:** Skip non-text (binary) files by checking file content (bolt.diy used `isBinaryFile(buffer)`).
* **Bundle File Contents:** Read each selected text file into a string and wrap it in a `<boltAction type="file" filePath="...">...</boltAction>` snippet (bolt.diy’s import sets `{type: "file", filePath, content}`).
* **Send Import Command:** After collecting all files, dispatch a special “Import Files” request to the chat backend (e.g., send an assistant message with the `<boltAction>` payload). Bolt.diy’s code creates a new chat with description “Folder Import: \[name]” and includes the files as a single `assistant` message (see their chat import logic).

> Citation: bolt.diy’s merged PR shows reading a folder, filtering out ignored patterns, and importing file contents into a new chat session.

## 4. Context Search & Long-Context Summarization

Enable searching within project code and summarizing long conversations to manage context. Bolt.diy’s enhancements [PR #1191](github.com/stackblitz-labs/bolt.diy/pull/1191) & [PR #1091](github.com/stackblitz-labs/bolt.diy/pull/1091) added **Code Context selection** and **Project Summary** features. Implementation tasks include:

* **Search Project Files:** Index or scan project files so the user can query “where is X defined?”. You may add a search bar that runs through the codebase (similar to bolt.diy’s “search codebase” feature in PR #1676).
* **Context Picker:** Allow the user to select relevant file snippets to include in the prompt. Bolt.diy’s commits mention “code context selection” where users can choose files as context.
* **Summarize Long Context:** Implement a function to automatically summarize long chat histories or code contexts. For example, after many messages, condense earlier parts into a summary using an LLM. Bolt.diy’s PR #1091 refers to “summary generation” to keep context manageable.
* **Project Summary Prompt:** Add an option to generate a top-level summary of the entire project (as bolt.diy’s release notes describe “Project Summary Features”). This could be a button that asks the AI to explain the project.

> Citations: See bolt.diy PRs #1191 and #1091 for adding code context selection and automatic summarization of long chats or project contents.

## 5. Auto-Detect and Fix WebContainer Errors

Make the app monitor webcontainer (Node.js preview) for run-time errors and automatically send fixes like in [PR #856](https://github.com/stackblitz-labs/bolt.diy/pull/856). Steps include:

* **Error Catching:** Wrap webcontainer start/install calls in try/catch. When an exception occurs, capture the error output. Bolt.diy’s commits mention catching WebContainer errors and raising alerts.
* **Alert System:** Display an alert to the user when an error is caught (bolt.diy shows “actionable alert so user can send them to AI for fixing”). Add a button in the alert like “Suggest Fix”.
* **AI Fix Prompt:** If the user requests it, send the error message (and possibly relevant code context) to the AI assistant as a new task “Fix this error”.
* **Apply Fix:** When the AI returns code changes, parse and apply them in the project. (This may reuse the existing code-action infrastructure.)
* **Logging:** Keep track of error details in a log for debugging.

> Citation: The bolt.diy release notes describe “catch errors from web container preview and show in actionable alert so user can send them to AI for fixing”, which guides this implementation.

## 6. Deployment Alert System

Implement notifications for project deployment events, like in [Commit #33305c4326a5c18874f858f55b0198fee295309d](https://github.com/stackblitz-labs/bolt.diy/commit/33305c4326a5c18874f858f55b0198fee295309d): . For example:

* **Success Alerts:** After a deployment (e.g. to GitHub Pages or Vercel), display a success message with a link.
* **Failure Alerts:** If deployment fails, show an error alert with details.
* **Background Checks:** Optionally poll for deployment status and update alerts accordingly.
* **UX:** Provide visual cues (toasts or banners) that won’t block the user.

> Citation: [Commit #33305c4326a5c18874f858f55b0198fee295309d](https://github.com/stackblitz-labs/bolt.diy/commit/33305c4326a5c18874f858f55b0198fee295309d)

## 7. Generate Mobile Apps with Expo, Enhanced UI (Glass Effect & Layout)

Apply a refreshed UI theme with translucent “glass” panels, moved buttons, and updated colors. Bolt.diy’s combined PRs and commits introduced polished UI changes:

* **Glass (Frosted) Effect:** Add CSS (e.g. `backdrop-filter: blur(…)`) to key containers for a frosted-glass look. Bolt.diy’s commit “add frosted glass feature” (commit `9e64c2c` on Jun 2) did this. You can enable or toggle this effect in your theme.
* **Rearrange Buttons:** Remove redundant buttons and group related actions (bolt.diy merged redundant preview buttons into a dropdown). Reposition toolbars or sidebar buttons for better UX.
* **Spacing and Sizing:** Tweak padding/gaps around chat bubbles and sidebar elements (bolt.diy “improved spacing between chat elements” and widened the editor/preview).
* **Color Scheme:** Update colors to match the new theme (darker glass panel, new accent colors). Bolt.diy also updated the default palette.
* **Test Across Devices:** Ensure the glass effect and layout work on various screen sizes and support dark mode if needed.

Add support for Expo mobile app templates and previews. This includes creating a new Expo project from the CLI and integrating a QR-code preview modal. For example, bolt.diy’s PR #1651 introduced an **Expo App Creation** workflow: it adds a starter template, extends prompts for mobile apps, and adds a new QR-code modal (see “Add Expo QR code generation and modal…”).

* **Integrate Expo template:** Add a new starter template for Expo in the codebase (bolt.diy added `EXPO_APP` in starter templates).
* **Extend prompts for mobile apps:** Update system and user prompts to include instructions for React Native or Expo (see “extend prompts with mobile app development instructions”).
* **QR Code Preview:** Implement a function to detect Expo URLs in console output and generate a QR code (bolt.diy added `qrCodeModal` and Expo URL detection). Show this modal in the UI so users can scan and open the app on a device.
* **Refine UI:** Add an Expo icon (e.g. `expo.svg`) and an “Open on device” button that triggers the QR modal, similar to bolt.diy’s changes.
* **Test Export:** Ensure that building/running the Expo project works and that the QR code correctly points to the running app.

> Citation: For reference, bolt.diy’s [PR #1651](https://github.com/stackblitz-labs/bolt.diy/pull/1651) particikurlly [Commit #9e64c2cccf0570bd6f662c91760f9e8c196a412d](https://github.com/stackblitz-labs/bolt.diy/commit/9e64c2cccf0570bd6f662c91760f9e8c196a412d) lists UI improvements like removing redundant buttons, improving layout, and refining initial UI elements, which align with these tasks. bolt.diy PR [#1651](https://github.com/stackblitz-labs/bolt.diy/pull/1651) added full Expo app support including a QR-code modal for mobile previews.

## 8. Enhanced System Prompts

Improve the default system prompts for better AI results, like in [PR #428](https://github.com/stackblitz-labs/bolt.diy/pull/428) & [PR #1757](https://github.com/stackblitz-labs/bolt.diy/pull/1757). Bolt.diy’s refactor commits on system prompts guide this:

* **Optimize Prompts:** Remove redundant or extraneous instructions from the system message (bolt.diy “improved fine-tuned system prompt” by cutting duplicates).
* **Refined Roles:** Clearly define assistant role and constraints. Ensure the prompt is concise but comprehensive.
* **Set as Default:** Replace the old prompt with the new one by default (as bolt.diy did).
* **Testing:** Compare token usage before/after (bolt.diy reported drastic token reduction).
* **Fine-tune Examples:** Adjust example conversations or guidelines in prompts to guide the AI toward desired behavior.

> Citation: bolt.diy’s commit shows they “refactored the new fine-tuned system prompt to heavily reduce token usage by removing redundant snippets” and set it as the default.

## 9. Refactor Code to Hooks & Services

Clean up the codebase by using React hooks and service modules. References: (https://github.com/stackblitz-labs/bolt.diy/commit/41e604c1dc5d5f7ffe8eb6246f273f84ae5852c9), (https://github.com/stackblitz-labs/bolt.diy/commit/de0a41b5f19e7dc63df7a916d653fd397891a798), (https://github.com/stackblitz-labs/bolt.diy/commit/cfc2fc75d8ad2bd1d7ea0864e918df15262671a4), (https://github.com/stackblitz-labs/bolt.diy/commit/b41691f6f28c2b9dd4818b5233076dd10c604f7c), 
   (https://github.com/stackblitz-labs/bolt.diy/commit/2f09d512bc888358ae917ab35e603342fb367dfc)
Tasks include:

* **Convert to Hooks:** Rewrite class or procedural components into functional components using hooks (`useState`, `useEffect`, etc.). For example, move chat logic out of components into custom hooks (such as `useChatStore`).
* **Service Modules:** Extract APIs and side effects into separate service files. For instance, move file I/O, WebContainer connection, or prompt-building logic into services.
* **Organize Stores:** Group related state into “stores” (as bolt.diy did by moving `qrCodeStore` and organizing stores under `lib/stores`).
* **Simplify Logic:** Remove duplicate code paths (bolt.diy “removed redundant checks” in file handling).
* **Code Cleanup:** Eliminate dead code and console logs, and ensure consistent coding style.
* **Review Commits:** Refer to bolt.diy’s refactoring commits (e.g., simplifying file event logic) for examples of breaking down functionality.

> Citation: See bolt.diy’s refactor commits, such as simplifying file processing logic, which illustrate moving logic into cleaner abstractions and eliminating redundant code.

---

## Additional Considerations

After implementing the above, consider these supplementary tasks:

* **Authentication & OAuth:** If your app connects to GitHub or other services, ensure token management and refresh logic are clean. Bolt.diy often updated GitHub auth flows (e.g., PR #1537).
* **Error Handling:** Standardize error boundaries across components. For example, use React’s `ErrorBoundary` or global error handlers like bolt.diy’s enhanced alerts.
* **Testing:** Add unit tests for new hooks/services and end-to-end tests for features like import/export, this will be done after all tasks.
* **Performance Optimization:** Profile startup and LLM response times, and implement caching or throttling (bolt.diy added “Message Processing Throttling” in #848).
