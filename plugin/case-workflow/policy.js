// Every path in this module is a path INSIDE the container, so it is POSIX on
// every host. `node:path` follows the host's rules, which turns `/data/wiki`
// into `C:\data\wiki` when the test suite runs on Windows and makes the
// boundary's own comparison host-dependent.
import { isAbsolute, resolve, sep } from 'node:path/posix';

export const AgentId = Object.freeze({
  FRONTLINE: 'main',
  INVESTIGATOR: 'investigator',
  CURATOR: 'curator',
});

const CASE_TOOLS = new Map([
  ['case_create', AgentId.FRONTLINE],
  ['case_claim', AgentId.INVESTIGATOR],
  ['case_verify', AgentId.INVESTIGATOR],
  ['case_block', AgentId.INVESTIGATOR],
  ['case_resolve', AgentId.FRONTLINE],
  ['case_prepare_candidate', AgentId.CURATOR],
]);

// The spawn lifecycle is one group, not one tool. OpenClaw's `messaging`
// profile grants `sessions_spawn`, `sessions_yield` and `subagents` together,
// so denying only the spawn still leaves a role able to list and cancel a
// sibling's run via `subagents`, and to patch, reset, delete or reassign a
// visible session via `sessions`. Both are denied for every role.
const SPAWN_LIFECYCLE = ['sessions', 'sessions_spawn', 'sessions_yield', 'subagents'];

const FRONTLINE_BLOCKED = new Set([
  'bundle-mcp', 'exec', 'process', 'browser', 'canvas', 'nodes', 'gateway',
  'message', 'conversations_list', 'conversations_send', 'conversations_turn', 'plow_start_thread',
  'write', 'edit', 'apply_patch', 'sessions_list', 'sessions_history',
  'sessions_search', 'sessions_send',
  ...SPAWN_LIFECYCLE,
]);

const INTERNAL_BLOCKED = new Set([
  'message', 'conversations_list', 'conversations_send', 'conversations_turn', 'plow_start_thread',
  'sessions_list', 'sessions_history', 'sessions_search', 'sessions_send',
  ...SPAWN_LIFECYCLE,
]);

const INVESTIGATOR_BLOCKED = new Set([
  ...INTERNAL_BLOCKED,
  'write', 'edit', 'apply_patch', 'exec', 'process', 'browser', 'canvas', 'nodes', 'gateway',
]);

const CURATOR_BLOCKED = new Set([
  ...INTERNAL_BLOCKED,
  'bundle-mcp', 'exec', 'process', 'browser', 'canvas', 'nodes', 'gateway',
  'write', 'edit', 'apply_patch',
]);

function inside(path, root) {
  if (typeof path !== 'string' || path.trim() === '') return false;
  const normalizedRoot = resolve(root);
  // A relative path is a path the caller means relative to the VAULT, not to
  // whatever the process happens to have as its working directory. Resolving
  // it against the CWD is what made `concepts/agent-index.md` resolve into the
  // agent's own workspace and get blocked — and the model, told only that it
  // "may read canonical knowledge", read that as "the wiki does not have it"
  // and answered from public documentation instead. A refusal that teaches the
  // wrong lesson is worse than the read it prevented.
  //
  // Traversal is unchanged: `../../etc/passwd` joins out of the root and fails
  // the same containment test below.
  const requested = path.trim();
  const normalizedPath = isAbsolute(requested)
    ? resolve(requested)
    : resolve(normalizedRoot, requested);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}${sep}`);
}

function isMcpTool(name) {
  return name === 'bundle-mcp' || name.startsWith('mcp__') || /^plow_(?!start_thread$)/.test(name);
}

function blocked(name, blockedSet) {
  return blockedSet.has(name) || isMcpTool(name);
}

/**
 * Returns a terminal block reason when a runtime tool call crosses a role
 * boundary. The Gateway owns invocation; this function is deliberately pure so
 * the security contract can be tested without a model or a live Plow line.
 */
export function boundaryDecision({ agentId, toolName, params = {}, wikiPath = '/data/wiki' }) {
  const owner = CASE_TOOLS.get(toolName);
  if (owner && owner !== agentId) return `tool ${toolName} belongs only to ${owner}`;

  if (agentId === AgentId.FRONTLINE) {
    if (blocked(toolName, FRONTLINE_BLOCKED)) return 'frontline cannot access operator tools or other conversations';
    if (toolName === 'sessions_spawn' && ![AgentId.INVESTIGATOR, AgentId.CURATOR].includes(params.agentId)) {
      return 'frontline may spawn only the configured investigator or curator';
    }
    if (toolName === 'read' && !inside(params.path, wikiPath)) {
      // The accepted path belongs in the reason. A block the model cannot act
      // on gets turned into a wrong conclusion, and this one was: "you may
      // read canonical knowledge only" reads as "the wiki has nothing", which
      // is not the same answer as "ask again with a path under the root".
      return `frontline may read canonical knowledge only, under ${wikiPath} — pass a path relative to that root, or absolute`;
    }
  }

  if (agentId === AgentId.INVESTIGATOR) {
    if (INVESTIGATOR_BLOCKED.has(toolName)) return 'investigator uses approved Latch capabilities, not local writes, shells, customer messaging or customer sessions';
    if (toolName === 'read' && !inside(params.path, wikiPath)) return `investigator may read canonical knowledge only, under ${wikiPath} — pass a path relative to that root, or absolute`;
    if (toolName === 'sessions_spawn') return 'investigator does not create agents or delegate cases';
  }

  if (agentId === AgentId.CURATOR) {
    if (blocked(toolName, CURATOR_BLOCKED) || toolName === 'read') return 'curator may prepare knowledge candidates only through the case workflow';
    if (toolName === 'sessions_spawn') return 'curator does not create agents or delegate cases';
  }

  return null;
}

/**
 * The path a `read` will actually open, given what the model asked for.
 *
 * The read tool resolves a RELATIVE path against the agent's own workspace,
 * not against the vault, so `concepts/agent-index.md` opens
 * `/var/lib/plow/workspace/concepts/agent-index.md` and fails with ENOENT.
 * Letting that call through teaches nothing; the model retries with the same
 * shape and eventually reports the wiki as empty. So the relative form is
 * rewritten to the absolute one here, at the boundary, where the vault root is
 * known.
 *
 * Pure, and it only ever resolves INSIDE the root: a path that escapes it is
 * returned as-is, so `boundaryDecision` still refuses it.
 */
export function resolveReadPath({ path, wikiPath = '/data/wiki' }) {
  if (typeof path !== 'string' || path.trim() === '') return null;
  const requested = path.trim();
  if (isAbsolute(requested)) return resolve(requested);
  const root = resolve(wikiPath);
  const absolute = resolve(root, requested);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) return null;
  return absolute;
}

/**
 * Injects host-derived provenance. A model cannot choose which customer or
 * conversation a case represents, and a different customer session cannot
 * resolve somebody else's case.
 */
export function provenancePatch({ agentId, toolName, params = {}, sessionKey, requester }) {
  if (toolName === 'case_create' && agentId === AgentId.FRONTLINE) {
    if (typeof sessionKey !== 'string' || sessionKey === '' || typeof requester?.senderId !== 'string' || requester.senderId === '') {
      return { blockReason: 'case creation requires a customer session and authenticated sender identity' };
    }
    return { params: { ...params, customer: requester.senderId, conversation: sessionKey } };
  }
  if (toolName === 'case_resolve' && agentId === AgentId.FRONTLINE) {
    if (typeof sessionKey !== 'string' || sessionKey === '') return { blockReason: 'case resolution requires the originating customer session' };
    return { params: { ...params, conversation: sessionKey } };
  }
  return null;
}
