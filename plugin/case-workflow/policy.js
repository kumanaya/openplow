import { resolve, sep } from 'node:path';

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

const FRONTLINE_BLOCKED = new Set([
  'bundle-mcp', 'exec', 'process', 'browser', 'canvas', 'nodes', 'gateway',
  'message', 'conversations_send', 'conversations_turn', 'plow_start_thread',
  'write', 'edit', 'apply_patch', 'sessions_list', 'sessions_history',
  'sessions_search', 'sessions_send',
]);

const INTERNAL_BLOCKED = new Set([
  'message', 'conversations_send', 'conversations_turn', 'plow_start_thread',
  'sessions_list', 'sessions_history', 'sessions_search', 'sessions_send',
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
  const normalizedPath = resolve(path);
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
      return 'frontline may read canonical knowledge only';
    }
  }

  if (agentId === AgentId.INVESTIGATOR) {
    if (INVESTIGATOR_BLOCKED.has(toolName)) return 'investigator uses approved Latch capabilities, not local writes, shells, customer messaging or customer sessions';
    if (toolName === 'read' && !inside(params.path, wikiPath)) return 'investigator may read canonical knowledge only';
    if (toolName === 'sessions_spawn') return 'investigator does not create agents or delegate cases';
  }

  if (agentId === AgentId.CURATOR) {
    if (blocked(toolName, CURATOR_BLOCKED) || toolName === 'read') return 'curator may prepare knowledge candidates only through the case workflow';
    if (toolName === 'sessions_spawn') return 'curator does not create agents or delegate cases';
  }

  return null;
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
