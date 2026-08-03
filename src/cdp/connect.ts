/**
 * Connect to a running Chrome instance via Chrome DevTools Protocol.
 * Finds the first FACEIT tab and activates Network domain.
 */
import CDP from "chrome-remote-interface";

export interface CDPConnection {
  client: CDP.Client;
  target: CDP.Target;
}

export async function connectToChrome(port: number = 9222): Promise<CDPConnection> {
  // List available targets
  const targets = await CDP.List({ port });
  console.log(`[CDP] Found ${targets.length} targets on port ${port}`);

  // Find a FACEIT tab
  const faceitTarget = targets.find(
    (t) =>
      t.type === "page" &&
      (t.url.includes("faceit.com") || t.title.toLowerCase().includes("faceit"))
  );

  if (!faceitTarget) {
    throw new Error(
      `No FACEIT tab found. Please open https://www.faceit.com in Chrome first.\n` +
        `Available targets:\n${targets
          .filter((t) => t.type === "page")
          .map((t) => `  ${t.title} (${t.url})`)
          .join("\n")}`
    );
  }

  console.log(`[CDP] Connecting to tab: ${faceitTarget.title} (${faceitTarget.url})`);

  const client = await CDP({
    target: faceitTarget,
    port,
  });

  // Activate Network domain
  await client.Network.enable();

  // Activate Page domain for URL changes
  await client.Page.enable();

  console.log("[CDP] Connected. Network domain active.");

  return { client, target: faceitTarget };
}

export async function disconnect(client: CDP.Client): Promise<void> {
  try {
    await client.Network.disable();
    await client.Page.disable();
    await client.close();
    console.log("[CDP] Disconnected cleanly.");
  } catch {
    // Already disconnected
  }
}
