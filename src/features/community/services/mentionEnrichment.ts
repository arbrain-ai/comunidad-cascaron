'use client';

import { supabase } from '@/shared/lib/supabase';

/**
 * Convert plain "@nombre" text into TipTap mention chips when the token has
 * exactly one matching profile by full_name prefix. Skips text already inside
 * an existing mention chip. Browser-only helper, called right before submit.
 *
 * Why prefix-only: keeps it conservative. If the token is ambiguous (e.g.
 * "@Arturo" matches 4 profiles) we leave the plain text alone so the user can
 * pick from the dropdown. If the token uniquely identifies a profile we save
 * them the click.
 */
export async function enrichPlainMentions(htmlContent: string): Promise<string> {
  if (!htmlContent || !htmlContent.includes('@')) return htmlContent;
  if (typeof document === 'undefined') return htmlContent;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = htmlContent;

  const textNodes = collectMatchableTextNodes(wrapper);
  if (textNodes.length === 0) return htmlContent;

  const tokensByNode: { node: Text; tokens: string[] }[] = [];
  const tokenSet = new Set<string>();

  for (const node of textNodes) {
    const text = node.textContent || '';
    const matches = Array.from(text.matchAll(/@([\p{L}\p{N}_]+)/gu));
    if (matches.length === 0) continue;
    const tokens = matches.map((m) => m[1]);
    tokens.forEach((t) => tokenSet.add(t));
    tokensByNode.push({ node, tokens });
  }

  if (tokenSet.size === 0) return htmlContent;

  const resolutions = await Promise.all(
    Array.from(tokenSet).map(async (token) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', `${token}%`)
        .limit(2);

      if (error || !data || data.length !== 1 || !data[0].full_name) {
        return [token, null] as const;
      }
      return [token, { id: data[0].id as string, full_name: data[0].full_name as string }] as const;
    })
  );

  const matchMap = new Map(resolutions);
  if (Array.from(matchMap.values()).every((v) => v === null)) return htmlContent;

  for (const { node, tokens } of tokensByNode) {
    const profilesForNode = tokens
      .map((t) => [t, matchMap.get(t)] as const)
      .filter(([, profile]) => profile !== null && profile !== undefined) as Array<
      readonly [string, { id: string; full_name: string }]
    >;
    if (profilesForNode.length === 0) continue;

    let html = escapeHtml(node.textContent || '');

    const sortedProfiles = profilesForNode.slice().sort((a, b) => b[0].length - a[0].length);
    for (const [token, profile] of sortedProfiles) {
      const safeName = escapeHtml(profile.full_name);
      const pattern = new RegExp(`@${escapeRegex(token)}(?![\\p{L}\\p{N}_])`, 'gu');
      html = html.replace(
        pattern,
        () =>
          `<span data-type="mention" data-id="${profile.id}" data-label="${safeName}" class="mention">@${safeName}</span>`
      );
    }

    const fragmentHost = document.createElement('span');
    fragmentHost.innerHTML = html;
    const fragment = document.createDocumentFragment();
    while (fragmentHost.firstChild) fragment.appendChild(fragmentHost.firstChild);
    node.parentNode?.replaceChild(fragment, node);
  }

  return wrapper.innerHTML;
}

function collectMatchableTextNodes(root: HTMLElement): Text[] {
  const result: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (isInsideMention(n.parentElement, root)) continue;
    result.push(n as Text);
  }
  return result;
}

function isInsideMention(el: HTMLElement | null, root: HTMLElement): boolean {
  let cur: HTMLElement | null = el;
  while (cur && cur !== root) {
    if (cur.getAttribute && cur.getAttribute('data-type') === 'mention') return true;
    cur = cur.parentElement;
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * True when the HTML contains "@palabra" outside any existing mention chip.
 * Used to detect drafts that look like mentions but never became chips,
 * which TipTap mention extension can't recover from on setContent.
 */
export function hasUnresolvedPlainMention(htmlContent: string): boolean {
  if (!htmlContent || !htmlContent.includes('@')) return false;
  const stripped = htmlContent.replace(
    /<span[^>]*data-type=["']mention["'][^>]*>[\s\S]*?<\/span>/gi,
    ''
  );
  return /@[\p{L}\p{N}_]+/u.test(stripped);
}
