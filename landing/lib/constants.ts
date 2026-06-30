export type InstallTab = "claude" | "npm";

export const INSTALL_CMDS: Record<InstallTab, string> = {
  claude: "claude plugin add github:maferland/keyhole",
  npm: "npm install -g @maferland/keyhole",
};

export const INSTALL_CAPTIONS: Record<InstallTab, string> = {
  claude: "Runs on Node · macOS, Linux · MIT licensed",
  npm: "then teach your agent to use keyhole — see the README for a one-liner",
};

export type Dest = "keychain" | "file" | "env";

export interface DestEntry {
  dest: string;
  retr: string;
  note: string;
}

export const DEST_DATA: Record<Dest, DestEntry> = {
  keychain: {
    dest: "keychain:OPENAI_API_KEY",
    retr: "security find-generic-password -s OPENAI_API_KEY -a $USER -w",
    note: "encrypted at rest · macOS Keychain",
  },
  file: {
    dest: "file:./.secrets/openai",
    retr: "cat ./.secrets/openai",
    note: "raw value on disk · mode 0600",
  },
  env: {
    dest: "env:./.env.local",
    retr: "grep OPENAI_API_KEY ./.env.local | cut -d= -f2-",
    note: "NAME=value lines · mode 0600",
  },
};
