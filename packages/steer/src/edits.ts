export interface EditInput {
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;
}

export type Applied =
  { ok: true; content: string } | { ok: false; reason: string };

const occurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

export const applyEdit = (content: string, edit: EditInput): Applied => {
  const oldString = edit.old_string ?? '';
  const newString = edit.new_string ?? '';
  if (oldString.length === 0) {
    if (content.length === 0) return { ok: true, content: newString };
    return {
      ok: false,
      reason: 'the edit has an empty old_string on a file that is not empty',
    };
  }
  const count = occurrences(content, oldString);
  if (count === 0) {
    return { ok: false, reason: 'old_string was not found in the file' };
  }
  if (edit.replace_all === true) {
    return { ok: true, content: content.split(oldString).join(newString) };
  }
  if (count > 1) {
    return {
      ok: false,
      reason: `old_string appears ${count} times and replace_all is not set`,
    };
  }
  const at = content.indexOf(oldString);
  return {
    ok: true,
    content: `${content.slice(0, at)}${newString}${content.slice(at + oldString.length)}`,
  };
};

export const applyEdits = (content: string, edits: EditInput[]): Applied => {
  if (edits.length === 0) {
    return { ok: false, reason: 'the MultiEdit payload has no edits' };
  }
  let current = content;
  for (const [index, edit] of edits.entries()) {
    const applied = applyEdit(current, edit);
    if (!applied.ok) {
      return {
        ok: false,
        reason: `edit ${index + 1} of ${edits.length}: ${applied.reason}`,
      };
    }
    current = applied.content;
  }
  return { ok: true, content: current };
};

export interface WriteInput extends EditInput {
  content?: string;
  edits?: EditInput[];
}

export const pendingContent = (
  tool: string,
  input: WriteInput,
  original: string,
): Applied => {
  if (tool === 'Write') return { ok: true, content: input.content ?? '' };
  if (tool === 'Edit') return applyEdit(original, input);
  if (tool === 'MultiEdit') return applyEdits(original, input.edits ?? []);
  return {
    ok: false,
    reason: `legion-steer does not know how ${tool} changes a file`,
  };
};
