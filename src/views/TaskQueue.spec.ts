import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('task queue assignment', () => {
  it('opens the single assignee modal instead of assigning a hard-coded owner', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/TaskQueue.vue'), 'utf8');

    expect(source).toContain('TaskAssigneeModal');
    expect(source).toContain('openAssigneeModal(taskCard.workEffort.workEffortId)');
    expect(source).toContain('modalController.create');
    expect(source).toContain('operationsStore.assignWorkEffort(workEffortId, assignee.name)');
    expect(source).not.toContain("'Taylor Brooks'");
  });
});
