import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('order detail actions', () => {
  it('uses Ionic action surfaces instead of browser prompts', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('actionSheetController');
    expect(source).toContain('alertController');
    expect(source).toContain('legacySalesOrderActions');
    expect(source).not.toContain('window.prompt');
  });

  it('surfaces supported actions near their matching order sections', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/OrderDetail.vue'), 'utf8');

    expect(source).toContain('openOrderActions');
    expect(source).toContain('openItemActions');
    expect(source).toContain('openShipGroupActions');
    expect(source).toContain('openCommunicationActions');
    expect(source).toContain('openShipmentDocumentActions');
  });
});
